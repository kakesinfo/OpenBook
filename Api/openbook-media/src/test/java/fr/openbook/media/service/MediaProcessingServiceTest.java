package fr.openbook.media.service;

import fr.openbook.media.config.MediaProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;

import static org.junit.jupiter.api.Assertions.*;

class MediaProcessingServiceTest {

    private MediaProcessingService processingService;

    @BeforeEach
    void setUp() {
        MediaProperties props = new MediaProperties();
        props.setMaxWidth(640);
        props.setMaxHeight(960);
        props.setWebpQuality(82.0f);
        processingService = new MediaProcessingService(props);
    }

    @Test
    void testProcessMasterFromPng() throws IOException {
        // Create 1200x1600 test image (should downsize to fit inside 640x960)
        BufferedImage img = new BufferedImage(1200, 1600, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        g.setColor(Color.RED);
        g.fillRect(0, 0, 1200, 1600);
        g.setColor(Color.BLUE);
        g.drawString("Test OpenBook Media", 100, 100);
        g.dispose();

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        ImageIO.write(img, "png", baos);
        byte[] pngBytes = baos.toByteArray();

        MediaProcessingService.ProcessResult result = processingService.processMaster(pngBytes);

        System.out.println("Result dimensions: " + result.width() + "x" + result.height() + ", data length: " + result.data().length);
        assertNotNull(result);
        assertNotNull(result.data());
        assertTrue(result.data().length > 0);
        assertTrue(result.width() <= 640, "Width should be <= 640 but was " + result.width());
        assertTrue(result.height() <= 960, "Height should be <= 960 but was " + result.height());

        // Verify decoded WebP
        BufferedImage decoded = processingService.decodeImage(result.data());
        assertNotNull(decoded);
        assertEquals(result.width(), decoded.getWidth());
        assertEquals(result.height(), decoded.getHeight());
    }

    @Test
    void testResizeFromMaster() throws IOException {
        BufferedImage img = new BufferedImage(600, 800, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        g.setColor(Color.GREEN);
        g.fillRect(0, 0, 600, 800);
        g.dispose();

        byte[] masterWebp = processingService.encodeWebp(img, 82.0f);
        assertTrue(masterWebp.length > 0);

        byte[] thumbnail = processingService.resizeFromMaster(masterWebp, 160, 0);
        assertNotNull(thumbnail);
        assertTrue(thumbnail.length > 0);

        BufferedImage thumbImg = processingService.decodeImage(thumbnail);
        assertNotNull(thumbImg);
        assertEquals(160, thumbImg.getWidth());
    }
}
