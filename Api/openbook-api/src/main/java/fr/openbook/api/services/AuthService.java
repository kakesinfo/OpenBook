package fr.openbook.api.services;

import fr.openbook.api.dtos.auth.LoginRequestDTO;
import fr.openbook.api.dtos.auth.RegisterRequestDTO;
import fr.openbook.api.dtos.auth.RegisterResponseDTO;
import fr.openbook.api.entities.UserEntity;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import lombok.NonNull;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class AuthService
{
    @Autowired
    private RepositoryService repositoryService;

    @Autowired
    private BCryptPasswordEncoder bCryptPasswordEncoder;

    @Autowired
    private AuthenticationManager authenticationManager;

    public RegisterResponseDTO register(@NonNull RegisterRequestDTO user) {
        if (repositoryService.getUserRepository().existsByUsernameOrEmail(user.getUsername(), user.getEmail()))
            return null;

        UserEntity userEntity = new UserEntity();
        userEntity.setUsername(user.getUsername());
        userEntity.setEmail(user.getEmail());
        userEntity.setPassword(bCryptPasswordEncoder.encode(user.getPassword()));

        userEntity = repositoryService.getUserRepository().save(userEntity);

        return new RegisterResponseDTO(userEntity.getId());
    }

    public UserEntity login(@NonNull LoginRequestDTO loginDTO) {
        String identifier = loginDTO.getEmail() != null ? loginDTO.getEmail().trim() : "";
        Optional<UserEntity> result = repositoryService.getUserRepository().findByEmailIgnoreCase(identifier);
        if (result.isEmpty()) {
            result = repositoryService.getUserRepository().findByUsernameIgnoreCase(identifier);
        }

        if (result.isEmpty())
            return null;

        UserEntity userEntity = result.get();

        if (!bCryptPasswordEncoder.matches(loginDTO.getPassword(), userEntity.getPassword()))
            return null;

        authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(
            userEntity.getEmail(),
            loginDTO.getPassword()
        ));

        return userEntity;
    }

    public void logout(@NonNull HttpSession session, @NonNull HttpServletResponse response) {
        session.invalidate();
    }
}
