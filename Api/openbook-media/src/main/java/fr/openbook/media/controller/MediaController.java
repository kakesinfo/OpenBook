package fr.openbook.media.controller;

import fr.openbook.api.services.media.MediaService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.multipart.MultipartHttpServletRequest;

import java.io.IOException;
import java.util.Map;

@RestController
@RequiredArgsConstructor
public class MediaController {

    private final MediaService mediaService;

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of(
                "status", "UP",
                "service", "openbook-media"
        ));
    }

    /**
     * POST /images: Create a virtual image slot and return UUID.
     */
    @PostMapping("/images")
    public ResponseEntity<Map<String, Object>> createVirtualImage() {
        String id = mediaService.createVirtualImage();
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                "id", id,
                "status", "pending"
        ));
    }

    /**
     * POST /images/{id} & POST /images/{id}/upload (multipart form upload).
     */
    @PostMapping(value = {"/images/{id}", "/images/{id}/upload"}, consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> uploadImageMultipart(
            @PathVariable("id") String id,
            HttpServletRequest request) throws IOException {

        MultipartFile file = null;
        if (request instanceof MultipartHttpServletRequest multipartRequest) {
            file = multipartRequest.getFile("file");
            if (file == null) {
                file = multipartRequest.getFile("image");
            }
        }

        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "No file uploaded under 'file' or 'image' field"));
        }

        Map<String, Object> result = mediaService.uploadImage(id, file.getBytes(), file.getContentType());
        return ResponseEntity.ok(result);
    }

    /**
     * POST /images/{id} & POST /images/{id}/upload (JSON remote URL upload).
     */
    @PostMapping(value = {"/images/{id}", "/images/{id}/upload"}, consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> uploadImageUrl(
            @PathVariable("id") String id,
            @RequestBody Map<String, String> payload) {

        String remoteUrl = payload.get("url");
        if (remoteUrl == null || remoteUrl.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid JSON body, expected {\"url\": \"...\"}"));
        }

        Map<String, Object> result = mediaService.uploadRemoteUrl(id, remoteUrl);
        return ResponseEntity.ok(result);
    }

    /**
     * POST /images/{id} & POST /images/{id}/upload (raw binary stream upload fallback).
     */
    @PostMapping(value = {"/images/{id}", "/images/{id}/upload"}, consumes = MediaType.APPLICATION_OCTET_STREAM_VALUE)
    public ResponseEntity<Map<String, Object>> uploadImageBinary(
            @PathVariable("id") String id,
            @RequestBody byte[] rawBytes,
            HttpServletRequest request) {

        if (rawBytes == null || rawBytes.length == 0) {
            return ResponseEntity.badRequest().body(Map.of("error", "Empty request body"));
        }

        String contentType = request.getContentType();
        Map<String, Object> result = mediaService.uploadImage(id, rawBytes, contentType);
        return ResponseEntity.ok(result);
    }

    /**
     * GET /images/{id} & GET /images/{id}/info: Get image metadata.
     */
    @GetMapping({"/images/{id}", "/images/{id}/info"})
    public ResponseEntity<Map<String, Object>> getImageInfo(@PathVariable("id") String id) {
        Map<String, Object> info = mediaService.getImageInfo(id);
        return ResponseEntity.ok(info);
    }

    /**
     * GET /images/{id}/blob & HEAD /images/{id}/blob: Get binary WebP blob.
     */
    @RequestMapping(value = "/images/{id}/blob", method = {RequestMethod.GET, RequestMethod.HEAD})
    public ResponseEntity<byte[]> getImageBlob(
            @PathVariable("id") String id,
            @RequestParam(value = "w", required = false) Integer widthW,
            @RequestParam(value = "width", required = false) Integer widthLong,
            @RequestParam(value = "h", required = false) Integer heightH,
            @RequestParam(value = "height", required = false) Integer heightLong,
            @RequestParam(value = "size", required = false) String size,
            @RequestHeader(value = "If-None-Match", required = false) String ifNoneMatch) {

        Integer targetW = widthW != null ? widthW : widthLong;
        Integer targetH = heightH != null ? heightH : heightLong;

        ResponseEntity<byte[]> response = mediaService.getImageBlob(id, targetW, targetH, size);
        if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
            return response;
        }

        String etag = response.getHeaders().getETag();
        if (etag != null && ifNoneMatch != null) {
            String cleanEtag = etag.replaceAll("^\"|\"$", "");
            String cleanMatch = ifNoneMatch.replaceAll("^\"|\"$", "");
            if (cleanEtag.equals(cleanMatch)) {
                return ResponseEntity.status(HttpStatus.NOT_MODIFIED).eTag(etag).build();
            }
        }

        return response;
    }

    /**
     * DELETE /images/{id}: Delete image and variants from storage and database.
     */
    @DeleteMapping("/images/{id}")
    public ResponseEntity<Void> deleteImage(@PathVariable("id") String id) {
        mediaService.deleteImage(id);
        return ResponseEntity.noContent().build();
    }
}
