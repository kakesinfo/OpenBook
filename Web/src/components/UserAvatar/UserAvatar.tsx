import { API_URL } from '../../config/api.ts';
import './UserAvatar.scss';

interface UserAvatarProps {
    avatar?: string | null;
    name?: string | null;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
}

export function UserAvatar({ avatar, name, size = 'md', className = '' }: UserAvatarProps) {
    const isImage = avatar && (avatar.startsWith('http://') || avatar.startsWith('https://') || avatar.startsWith('data:image') || avatar.startsWith('/'));
    const imageSrc = avatar?.startsWith('/') ? `${API_URL}${avatar}` : (avatar || '');
    const initial = (name || 'U')[0].toUpperCase();

    return (
        <div className={`user-avatar user-avatar--${size} ${className}`}>
            {isImage ? (
                <img src={imageSrc} alt={name || 'Avatar'} className="user-avatar__img" />
            ) : avatar ? (
                <span className="user-avatar__emoji">{avatar}</span>
            ) : (
                <span className="user-avatar__initial">{initial}</span>
            )}
        </div>
    );
}

export default UserAvatar;
