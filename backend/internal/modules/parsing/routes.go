package parsing

import (
	"github.com/gin-gonic/gin"
	"github.com/UN-Self/ResumeGenius/backend/internal/shared/storage"
	"gorm.io/gorm"
)

func RegisterRoutes(rg *gin.RouterGroup, db *gorm.DB, store storage.FileStorage) {
	pdfParser := NewPDFParser()
	docxParser := NewDocxParser()
	service := NewParsingService(db, pdfParser, docxParser, nil, store)
	handler := NewHandler(service)
	rg.POST("/parsing/parse", handler.ParseProject)
}
