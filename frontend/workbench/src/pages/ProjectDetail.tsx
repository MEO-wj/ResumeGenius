import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import {
  intakeApi, parsingApi, workbenchApi, request,
  ApiError, type Project, type Asset, type ParsedContent,
} from '@/lib/api-client'
import { useAutoSave } from '@/hooks/useAutoSave'
import AssetList from '@/components/intake/AssetList'
import ParsedSidebar from '@/components/intake/ParsedSidebar'
import DeleteConfirm from '@/components/intake/DeleteConfirm'
import UploadDialog from '@/components/intake/UploadDialog'
import GitRepoDialog from '@/components/intake/GitRepoDialog'
import NoteDialog from '@/components/intake/NoteDialog'
import { A4Canvas } from '@/components/editor/A4Canvas'
import { ActionBar } from '@/components/editor/ActionBar'
import { FormatToolbar } from '@/components/editor/FormatToolbar'
import { SaveIndicator } from '@/components/editor/SaveIndicator'
import { AiPanelPlaceholder } from '@/components/editor/AiPanelPlaceholder'
import { EditorSkeleton } from '@/components/editor/EditorSkeleton'
import type { Draft } from '@/types/editor'

type Phase = 'intake' | 'parsing' | 'editing'

export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const pid = Number(projectId)

  // Phase state
  const [phase, setPhase] = useState<Phase>('intake')
  const [parsedContents, setParsedContents] = useState<ParsedContent[]>([])
  const [parseError, setParseError] = useState('')

  // Intake state
  const [project, setProject] = useState<Project | null>(null)
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [gitOpen, setGitOpen] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const [editingNote, setEditingNote] = useState<Asset | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'project' | 'asset'; id: number } | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Editor state
  const [draftId, setDraftId] = useState<string | null>(null)

  // TipTap editor (created eagerly, only rendered in editing phase)
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'resume-content outline-none',
        style: 'min-height: 261mm;',
      },
    },
  })

  // Auto-save hook
  const { scheduleSave, flush, retry, status, lastSavedAt } = useAutoSave({
    save: async (html: string) => {
      if (draftId) {
        await request(`/drafts/${draftId}`, { method: 'PUT', body: JSON.stringify({ html_content: html }) })
      }
    },
    saveUrl: draftId ? `/api/v1/drafts/${draftId}` : undefined,
  })

  // --- Load intake data ---
  const load = useCallback(async () => {
    try {
      setLoading(true)
      const [proj, asts] = await Promise.all([
        intakeApi.getProject(pid),
        intakeApi.listAssets(pid),
      ])
      setProject(proj)
      setAssets(asts)
      setError('')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [pid])

  useEffect(() => { load() }, [load])

  // --- Load draft content when entering editing phase ---
  useEffect(() => {
    if (phase !== 'editing' || !draftId || !editor) return
    request<Draft>(`/drafts/${draftId}`)
      .then((data) => {
        if (data.html_content) {
          editor.commands.setContent(data.html_content)
        }
      })
      .catch((err) => console.error('Failed to load draft:', err))
  }, [phase, draftId, editor])

  // --- Connect editor to autosave (only in editing phase) ---
  useEffect(() => {
    if (phase !== 'editing' || !editor) return
    const handleUpdate = () => scheduleSave(editor.getHTML())
    editor.on('update', handleUpdate)
    return () => { editor.off('update', handleUpdate) }
  }, [editor, phase, scheduleSave])

  // Flush pending saves on unmount
  useEffect(() => { flush() }, [flush])

  // --- Intake handlers ---
  const handleUpload = async (file: File) => {
    await intakeApi.uploadFile(pid, file)
    await load()
  }

  const handleCreateGit = async (repoUrl: string) => {
    await intakeApi.createGitRepo(pid, repoUrl)
    await load()
  }

  const handleCreateNote = async (content: string, label: string) => {
    await intakeApi.createNote(pid, content, label)
    await load()
  }

  const handleUpdateNote = async (content: string, label: string) => {
    if (!editingNote) return
    await intakeApi.updateNote(editingNote.id, content, label)
    setEditingNote(null)
    await load()
  }

  const handleDeleteAsset = async () => {
    if (!deleteTarget || deleteTarget.type !== 'asset') return
    try {
      setDeleting(true)
      await intakeApi.deleteAsset(deleteTarget.id)
      await load()
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  const handleDeleteProject = async () => {
    if (!deleteTarget || deleteTarget.type !== 'project') return
    try {
      setDeleting(true)
      await intakeApi.deleteProject(pid)
      navigate('/')
    } catch {
      setError('删除失败')
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  const handleEditNote = (asset: Asset) => {
    setEditingNote(asset)
    setNoteOpen(true)
  }

  // --- Parse handler ---
  const handleParse = async () => {
    try {
      setPhase('parsing')
      setParseError('')
      const result = await parsingApi.parseProject(pid)
      setParsedContents(result.parsed_contents)

      // Ensure a draft exists for editing
      const proj = await intakeApi.getProject(pid)
      if (proj.current_draft_id) {
        setDraftId(String(proj.current_draft_id))
      } else {
        const draft = await workbenchApi.createDraft(pid)
        setDraftId(String(draft.id))
      }

      setPhase('editing')
    } catch (err) {
      setParseError(err instanceof ApiError ? err.message : '解析失败')
      setPhase('intake')
    }
  }

  // --- Loading / error states ---
  if (loading) {
    return (
      <div className="h-screen bg-[var(--color-page-bg)] flex items-center justify-center">
        <p className="text-[var(--color-text-secondary)] text-sm">加载中...</p>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="h-screen bg-[var(--color-page-bg)] flex items-center justify-center">
        <p className="text-red-500 text-sm">{error || '项目不存在'}</p>
      </div>
    )
  }

  // --- Intake content (rendered inside left panel) ---
  const intakeContent = (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <div className="min-w-0 flex-1">
          <button
            onClick={() => navigate('/')}
            className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-main)] transition-colors mb-1"
          >
            &larr; 返回项目列表
          </button>
          <h1 className="font-serif text-xl font-semibold text-[var(--color-text-main)] truncate">
            {project.title}
          </h1>
        </div>
        <button
          onClick={() => setDeleteTarget({ type: 'project', id: pid })}
          className="shrink-0 ml-4 text-xs text-[var(--color-text-secondary)] hover:text-red-500 px-3 py-1.5 rounded-lg border border-[var(--color-divider)] hover:border-red-300 transition-colors"
        >
          删除项目
        </button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-2.5 text-sm rounded-lg bg-red-50 text-red-600 border border-red-200">
          {error}
        </div>
      )}
      {parseError && (
        <div className="mb-4 px-4 py-2.5 text-sm rounded-lg bg-red-50 text-red-600 border border-red-200">
          解析失败：{parseError}
        </div>
      )}

      <div className="flex gap-2 mb-5">
        <button
          onClick={() => setUploadOpen(true)}
          className="h-9 px-4 text-sm font-medium rounded-lg bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] transition-colors"
        >
          上传文件
        </button>
        <button
          onClick={() => setGitOpen(true)}
          className="h-9 px-4 text-sm font-medium rounded-lg border border-[var(--color-divider)] bg-white text-[var(--color-text-main)] hover:bg-gray-50 transition-colors"
        >
          接入 Git
        </button>
        <button
          onClick={() => { setEditingNote(null); setNoteOpen(true) }}
          className="h-9 px-4 text-sm font-medium rounded-lg border border-[var(--color-divider)] bg-white text-[var(--color-text-main)] hover:bg-gray-50 transition-colors"
        >
          添加备注
        </button>
      </div>

      <AssetList
        assets={assets}
        onDelete={(id) => setDeleteTarget({ type: 'asset', id })}
        onEditNote={handleEditNote}
      />

      {assets.length > 0 && (
        <button
          onClick={handleParse}
          className="mt-6 w-full h-11 text-sm font-medium rounded-lg bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] transition-colors"
        >
          下一步：开始解析
        </button>
      )}

      <UploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)} onUpload={handleUpload} />
      <GitRepoDialog open={gitOpen} onClose={() => setGitOpen(false)} onSubmit={handleCreateGit} />
      <NoteDialog
        open={noteOpen}
        onClose={() => { setNoteOpen(false); setEditingNote(null) }}
        onSubmit={editingNote ? handleUpdateNote : handleCreateNote}
        initialNote={editingNote ?? undefined}
      />
      <DeleteConfirm
        open={deleteTarget !== null}
        title={deleteTarget?.type === 'project' ? '删除项目' : '删除资料'}
        message={deleteTarget?.type === 'project'
          ? '删除后该项目下的所有资料和文件将被永久删除，此操作不可撤销。'
          : '删除后该资料将被永久删除，此操作不可撤销。'}
        onConfirm={deleteTarget?.type === 'project' ? handleDeleteProject : handleDeleteAsset}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  )

  // --- Skeleton for parsing phase center ---
  const centerSkeleton = (
    <A4Canvas><EditorSkeleton /></A4Canvas>
  )

  // --- Skeleton for parsing phase right ---
  const rightSkeleton = (
    <div className="p-6 space-y-4">
      <div className="skeleton h-4 w-24" />
      <div className="skeleton h-10 w-full rounded-lg" />
      <div className="skeleton h-10 w-full rounded-lg" />
      <div className="skeleton h-10 w-3/4 rounded-lg" />
    </div>
  )

  return (
    <div className={`workspace phase-${phase}`}>
      {/* Left Panel */}
      <div className="panel-left">
        {phase === 'intake' ? intakeContent : <ParsedSidebar contents={parsedContents} />}
      </div>

      {/* Center Panel */}
      <div className="panel-center">
        {phase === 'parsing' && centerSkeleton}
        {phase === 'editing' && (
          <div className="flex flex-col h-full">
            <ActionBar
              projectName={project.title}
              saveIndicator={<SaveIndicator status={status} lastSavedAt={lastSavedAt} onRetry={retry} />}
            />
            <div className="flex-1 overflow-auto">
              <A4Canvas editor={editor} />
            </div>
            <div className="format-toolbar">
              <FormatToolbar editor={editor} />
            </div>
          </div>
        )}
      </div>

      {/* Right Panel */}
      <div className="panel-right">
        {phase === 'parsing' && rightSkeleton}
        {phase === 'editing' && <AiPanelPlaceholder />}
      </div>
    </div>
  )
}
