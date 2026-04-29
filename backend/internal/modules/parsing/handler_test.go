package parsing

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/UN-Self/ResumeGenius/backend/internal/shared/middleware"
)

func init() {
	gin.SetMode(gin.TestMode)
}

// mockParser implements the projectParser interface for testing.
type mockParser struct {
	result []ParsedContent
	err    error
}

func (m *mockParser) ParseForUser(_ string, _ uint) ([]ParsedContent, error) {
	return m.result, m.err
}

func setupTestRouter(svc projectParser) *gin.Engine {
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set(middleware.ContextUserID, "user-123")
		c.Next()
	})
	h := NewHandler(svc)
	r.POST("/parsing/parse", h.ParseProject)
	return r
}

func TestParseProject_Success(t *testing.T) {
	svc := &mockParser{
		result: []ParsedContent{
			{AssetID: 1, Type: AssetTypeResumePDF, Text: "hello world"},
		},
	}
	r := setupTestRouter(svc)
	body, _ := json.Marshal(parseRequest{ProjectID: 1})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/parsing/parse", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["code"].(float64) != 0 {
		t.Fatalf("expected code 0, got %v", resp["code"])
	}
	data := resp["data"].(map[string]interface{})
	contents := data["parsed_contents"].([]interface{})
	if len(contents) != 1 {
		t.Fatalf("expected 1 parsed content, got %d", len(contents))
	}
}

func TestParseProject_InvalidBody(t *testing.T) {
	r := setupTestRouter(&mockParser{})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/parsing/parse", bytes.NewReader([]byte("invalid")))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestParseProject_Unauthorized(t *testing.T) {
	r := gin.New()
	h := NewHandler(&mockParser{})
	r.POST("/parsing/parse", h.ParseProject)
	body, _ := json.Marshal(parseRequest{ProjectID: 1})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/parsing/parse", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d: %d", w.Code, w.Body.Len())
	}
}

func TestParseProject_ProjectNotFound(t *testing.T) {
	svc := &mockParser{err: ErrProjectNotFound}
	r := setupTestRouter(svc)
	body, _ := json.Marshal(parseRequest{ProjectID: 99})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/parsing/parse", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["code"].(float64) != CodeProjectNotFound {
		t.Fatalf("expected code %d, got %v", CodeProjectNotFound, resp["code"])
	}
}

func TestParseProject_NoUsableAssets(t *testing.T) {
	svc := &mockParser{err: ErrNoUsableAssets}
	r := setupTestRouter(svc)
	body, _ := json.Marshal(parseRequest{ProjectID: 1})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/parsing/parse", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["code"].(float64) != CodeNoUsableAssets {
		t.Fatalf("expected code %d, got %v", CodeNoUsableAssets, resp["code"])
	}
}

func TestParseProject_ParseFailed(t *testing.T) {
	svc := &mockParser{err: errors.New("unexpected error")}
	r := setupTestRouter(svc)
	body, _ := json.Marshal(parseRequest{ProjectID: 1})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/parsing/parse", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["code"].(float64) != CodeParseFailed {
		t.Fatalf("expected code %d, got %v", CodeParseFailed, resp["code"])
	}
}
