package main

import (
	"bytes"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"os"

	_ "github.com/gen2brain/avif"
	"github.com/chai2010/webp"
	"github.com/disintegration/imaging"
)

type Processor struct {
	maxWidth    int
	maxHeight   int
	webpQuality float32
}

func NewProcessor(maxWidth, maxHeight int, quality float32) *Processor {
	return &Processor{
		maxWidth:    maxWidth,
		maxHeight:   maxHeight,
		webpQuality: quality,
	}
}

// ProcessMaster decodes any image format, downsizes to fit inside (maxWidth, maxHeight)
// and compresses into WebP format optimized for the web.
func (p *Processor) ProcessMaster(r io.Reader) ([]byte, int, int, error) {
	data, err := io.ReadAll(r)
	if err != nil {
		return nil, 0, 0, fmt.Errorf("failed to read image data: %w", err)
	}

	// Try standard decoding first
	img, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		// Try webp decoder
		var webpErr error
		img, webpErr = webp.Decode(bytes.NewReader(data))
		if webpErr != nil {
			return nil, 0, 0, fmt.Errorf("unsupported or corrupt image format: %v (webp: %v)", err, webpErr)
		}
	}

	bounds := img.Bounds()
	origW := bounds.Dx()
	origH := bounds.Dy()

	// Resize if larger than max allowed dimensions (preserves aspect ratio)
	var processed image.Image = img
	if origW > p.maxWidth || origH > p.maxHeight {
		processed = imaging.Fit(img, p.maxWidth, p.maxHeight, imaging.Lanczos)
	}

	finalBounds := processed.Bounds()
	finalW := finalBounds.Dx()
	finalH := finalBounds.Dy()

	var buf bytes.Buffer
	if err := webp.Encode(&buf, processed, &webp.Options{
		Lossless: false,
		Quality:  p.webpQuality,
	}); err != nil {
		return nil, 0, 0, fmt.Errorf("failed to encode to WebP: %w", err)
	}

	return buf.Bytes(), finalW, finalH, nil
}

// ResizeFromMaster loads the master image from disk, resizes it to target dimensions, and encodes to WebP
func (p *Processor) ResizeFromMaster(masterPath string, targetW, targetH int) ([]byte, error) {
	file, err := os.Open(masterPath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	img, err := webp.Decode(file)
	if err != nil {
		// Fallback to generic decode
		_, _ = file.Seek(0, 0)
		img, _, err = image.Decode(file)
		if err != nil {
			return nil, fmt.Errorf("failed to decode master image: %w", err)
		}
	}

	var resized image.Image
	if targetW > 0 && targetH > 0 {
		resized = imaging.Fit(img, targetW, targetH, imaging.Lanczos)
	} else if targetW > 0 {
		resized = imaging.Resize(img, targetW, 0, imaging.Lanczos)
	} else if targetH > 0 {
		resized = imaging.Resize(img, 0, targetH, imaging.Lanczos)
	} else {
		resized = img
	}

	var buf bytes.Buffer
	if err := webp.Encode(&buf, resized, &webp.Options{
		Lossless: false,
		Quality:  p.webpQuality,
	}); err != nil {
		return nil, fmt.Errorf("failed to encode resized WebP: %w", err)
	}

	return buf.Bytes(), nil
}
