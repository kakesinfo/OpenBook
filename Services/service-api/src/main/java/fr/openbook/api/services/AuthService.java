package fr.openbook.api.services;

import fr.openbook.api.dtos.auth.LoginRequestDTO;
import fr.openbook.api.dtos.auth.RegisterRequestDTO;
import fr.openbook.api.dtos.auth.RegisterResponseDTO;
import fr.openbook.api.entities.UserEntity;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import lombok.AllArgsConstructor;
import lombok.NonNull;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
@AllArgsConstructor
public class AuthService {

    private final RepositoryService repositoryService;
    private final BCryptPasswordEncoder bCryptPasswordEncoder;
    private final AuthenticationManager authenticationManager;

    public RegisterResponseDTO register(@NonNull RegisterRequestDTO user)
    {
        if (repositoryService.getUserRepository()
                .existsByUsernameOrEmail(user.getUsername(), user.getEmail()))
            return null;

        UserEntity userEntity = new UserEntity();
        userEntity.setUsername(user.getUsername());
        userEntity.setEmail(user.getEmail());
        userEntity.setPassword(bCryptPasswordEncoder.encode(user.getPassword()));

        userEntity = repositoryService.getUserRepository().save(userEntity);

        return new RegisterResponseDTO(userEntity.getId());
    }

    public UserEntity login(@NonNull LoginRequestDTO loginDTO) {
        Optional<UserEntity> result = repositoryService.getUserRepository().findByEmail(loginDTO.getEmail());

        if (result.isEmpty())
            return null;

        UserEntity userEntity = result.get();

        if (!bCryptPasswordEncoder.matches(loginDTO.getPassword(), userEntity.getPassword()))
            return null;

        authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(
            loginDTO.getEmail(),
            loginDTO.getPassword()
        ));

        return result.get();
    }

    public void logout(@NonNull HttpSession session, @NonNull HttpServletResponse response) {
        session.invalidate();
    }
}