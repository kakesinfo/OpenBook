package fr.openbook.api.services;

import fr.openbook.api.dtos.editor.CreateEditorDTO;
import fr.openbook.api.dtos.editor.EditorDTO;
import fr.openbook.api.dtos.editor.UpdateEditorDTO;
import fr.openbook.api.entities.EditorEntity;
import fr.openbook.api.repositories.EditorRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class EditorService {

    @Autowired
    private EditorRepository editorRepository;

    public List<EditorDTO> getAllEditors() {
        return editorRepository.findAll().stream().map(this::convertEntityToDTO).toList();
    }

    public EditorDTO getEditorById(Long id) {
        EditorEntity editorEntity = editorRepository.findById(id).orElse(null);

        if (editorEntity == null) {
            return null;
        }

        return convertEntityToDTO(editorEntity);
    }

    public EditorDTO createEditor(CreateEditorDTO editorDTO) {
        EditorEntity editorEntity = new EditorEntity();
        editorEntity.setName(editorDTO.getName());

        return convertEntityToDTO(editorRepository.save(editorEntity));
    }

    public EditorDTO updateEditor(UpdateEditorDTO editorDTO) {
        EditorEntity editorEntity = editorRepository.findById(editorDTO.getId()).orElse(null);

        if (editorEntity == null) {
            return null;
        }

        editorEntity.setName(editorDTO.getName());

        return convertEntityToDTO(editorRepository.save(editorEntity));
    }

    public void deleteEditor(Long id) {
        editorRepository.deleteById(id);
    }

    private EditorDTO convertEntityToDTO(EditorEntity entity) {
        EditorDTO entityDTO = new EditorDTO();
        entityDTO.setId(entity.getId());
        entityDTO.setName(entity.getName());
        return entityDTO;
    }
}