package parsing

import (
	"errors"
	"log"

	"github.com/UN-Self/ResumeGenius/backend/internal/shared/middleware"
	"github.com/UN-Self/ResumeGenius/backend/internal/shared/response"
	"github.com/gin-gonic/gin"
)

const (
	CodeParseFailed     = 2001
	CodeProjectNotFound = 2003
	CodeNoUsableAssets  = 2004
	CodeParamInvalid    = 2000
	CodeInternalError   = 50001
)

type projectParser interface {
	ParseForUser(userID string, projectID uint) ([]ParsedContent, error)
}

type Handler struct {
	service projectParser
}

func NewHandler(service projectParser) *Handler {
	return &Handler{service: service}
}

type parseRequest struct {
	ProjectID uint `json:"project_id" binding:"required"`
}

func userID(c *gin.Context) string {
	return middleware.UserIDFromContext(c)
}

func (h *Handler) ParseProject(c *gin.Context) {
	uid := userID(c)
	if uid == "" {
		response.Error(c, 40100, "unauthorized")
		return
	}

	var req parseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, CodeParamInvalid, "project_id is required")
		return
	}

	parsedContents, err := h.service.ParseForUser(uid, req.ProjectID)
	if err != nil {
		switch {
		case errors.Is(err, ErrProjectNotFound):
			response.Error(c, CodeProjectNotFound, "project not found")
		case errors.Is(err, ErrNoUsableAssets):
			response.Error(c, CodeNoUsableAssets, "project has no usable assets")
		default:
			log.Printf("[parsing] ParseForUser failed: %v", err)
			response.Error(c, CodeParseFailed, "failed to parse project assets")
		}
		return
	}

	response.Success(c, gin.H{"parsed_contents": parsedContents})
}
