package fr.openbook.api.services;

import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.UUID;

@Service
public class AvatarService {

    private static final long MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
    private static final int MAX_DIMENSION = 4096;
    private static final int TARGET_AVATAR_SIZE = 512;
    private final Path uploadDir;

    private static final byte[] PNG_SIGNATURE = new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A};

    public AvatarService() {
        this.uploadDir = Paths.get("uploads", "avatars").toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.uploadDir);
        } catch (IOException e) {
            throw new RuntimeException("Could not create avatar upload directory", e);
        }
    }

    public String saveAvatar(MultipartFile file) throws IOException {
        // 1. File presence and size check
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Veuillez sélectionner un fichier image.");
        }

        if (file.getSize() > MAX_FILE_SIZE) {
            throw new IllegalArgumentException("Le fichier est trop volumineux (maximum 5 Mo).");
        }

        // 2. Extension check
        String originalFilename = file.getOriginalFilename();
        if (originalFilename == null) {
            throw new IllegalArgumentException("Nom de fichier manquant.");
        }
        String lowerName = originalFilename.toLowerCase();
        if (!lowerName.endsWith(".jpg") && !lowerName.endsWith(".jpeg") && !lowerName.endsWith(".png")) {
            throw new IllegalArgumentException("Extension non autorisée. Seuls les fichiers JPG et PNG sont acceptés.");
        }

        // 3. MIME Content-Type check
        String contentType = file.getContentType();
        if (contentType == null || (!contentType.equalsIgnoreCase("image/jpeg") && !contentType.equalsIgnoreCase("image/png") && !contentType.equalsIgnoreCase("image/jpg"))) {
            throw new IllegalArgumentException("Type MIME invalide. Seuls les formats image/jpeg et image/png sont autorisés.");
        }

        // 4. Magic bytes inspection
        byte[] bytes = file.getBytes();
        if (bytes.length < 8) {
            throw new IllegalArgumentException("Fichier image corrompu ou trop petit.");
        }

        boolean isJpeg = bytes[0] == (byte) 0xFF && bytes[1] == (byte) 0xD8 && bytes[2] == (byte) 0xFF;
        boolean isPng = bytes[0] == PNG_SIGNATURE[0] && bytes[1] == PNG_SIGNATURE[1]
                && bytes[2] == PNG_SIGNATURE[2] && bytes[3] == PNG_SIGNATURE[3]
                && bytes[4] == PNG_SIGNATURE[4] && bytes[5] == PNG_SIGNATURE[5]
                && bytes[6] == PNG_SIGNATURE[6] && bytes[7] == PNG_SIGNATURE[7];

        if (!isJpeg && !isPng) {
            throw new IllegalArgumentException("Analyse de sécurité échouée : les octets magiques ne correspondent pas à une image JPG ou PNG valide.");
        }

        // 5. Decodability check & decompression bomb protection
        BufferedImage originalImage;
        try (InputStream is = new ByteArrayInputStream(bytes)) {
            originalImage = ImageIO.read(is);
        } catch (Exception e) {
            throw new IllegalArgumentException("Impossible de décoder l'image : fichier corrompu ou malicieux.");
        }

        if (originalImage == null) {
            throw new IllegalArgumentException("L'image est illisible ou contient des données malformées.");
        }

        int width = originalImage.getWidth();
        int height = originalImage.getHeight();
        if (width <= 0 || height <= 0) {
            throw new IllegalArgumentException("Dimensions d'image invalides.");
        }

        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
            throw new IllegalArgumentException("Dimensions d'image trop grandes (maximum 4096 x 4096 px).");
        }

        // 6. Sanitization and re-encoding:
        // By drawing into a fresh BufferedImage and writing a new PNG, all EXIF metadata,
        // embedded script tags, polyglot payloads, and comment injections are completely stripped.
        int targetWidth = width;
        int targetHeight = height;
        if (width > TARGET_AVATAR_SIZE || height > TARGET_AVATAR_SIZE) {
            if (width > height) {
                targetWidth = TARGET_AVATAR_SIZE;
                targetHeight = (int) ((double) height / width * TARGET_AVATAR_SIZE);
            } else {
                targetHeight = TARGET_AVATAR_SIZE;
                targetWidth = (int) ((double) width / height * TARGET_AVATAR_SIZE);
            }
        }

        BufferedImage sanitizedImage = new BufferedImage(targetWidth, targetHeight, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g2d = sanitizedImage.createGraphics();
        try {
            g2d.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            g2d.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g2d.drawImage(originalImage, 0, 0, targetWidth, targetHeight, null);
        } finally {
            g2d.dispose();
        }

        // 7. Safe UUID file storage
        String newFilename = UUID.randomUUID().toString() + ".png";
        Path targetPath = this.uploadDir.resolve(newFilename).normalize();

        // Path traversal defense check
        if (!targetPath.startsWith(this.uploadDir)) {
            throw new SecurityException("Tentative d'accès hors du répertoire d'upload détectée.");
        }

        ImageIO.write(sanitizedImage, "png", targetPath.toFile());

        return newFilename;
    }

    public Resource loadAvatarResource(String filename) {
        if (filename == null || !filename.matches("^[a-zA-Z0-9-]+\\.(png|jpg|jpeg)$")) {
            throw new IllegalArgumentException("Nom de fichier d'avatar invalide.");
        }

        Path filePath = this.uploadDir.resolve(filename).normalize();
        if (!filePath.startsWith(this.uploadDir)) {
            throw new SecurityException("Accès non autorisé.");
        }

        try {
            Resource resource = new UrlResource(filePath.toUri());
            if (resource.exists() && resource.isReadable()) {
                return resource;
            } else {
                return null;
            }
        } catch (Exception e) {
            return null;
        }
    }

    public void deleteAvatarFile(String avatarUrl) {
        if (avatarUrl == null || !avatarUrl.startsWith("/user/avatar/")) return;
        String filename = avatarUrl.substring("/user/avatar/".length());
        if (!filename.matches("^[a-zA-Z0-9-]+\\.(png|jpg|jpeg)$")) return;
        try {
            Path filePath = this.uploadDir.resolve(filename).normalize();
            if (filePath.startsWith(this.uploadDir)) {
                Files.deleteIfExists(filePath);
            }
        } catch (Exception ignored) {}
    }
}
