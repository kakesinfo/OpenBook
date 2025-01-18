package fr.chapter_and_chai.api.security;

import fr.chapter_and_chai.api.entities.UserEntity;
import fr.chapter_and_chai.api.services.RepositoryService;
import lombok.AllArgsConstructor;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
@AllArgsConstructor
public class CustomUserDetailsService implements UserDetailsService
{
    private final RepositoryService repositoryService;

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException
    {
        Optional<UserEntity> result = repositoryService.getUserRepository().findByUsername(username);

        if (result.isEmpty())
            throw new UsernameNotFoundException("User not found");

        UserEntity userEntity = result.get();

        return User.builder()
                .username(userEntity.getUsername())
                .password(userEntity.getPassword())
                .authorities("USER")
                .accountExpired(false)
                .accountLocked(false)
                .credentialsExpired(false)
                .disabled(false)
                .build();
    }
}
