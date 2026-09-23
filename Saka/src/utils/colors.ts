// utils/colors.ts

export const getAvatarColor = (id: string | number): string => {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
    '#FFEAA7', '#DDA0DD', '#FF8C94', '#FF9FF3', 
    '#54A0FF', '#5F27CD', '#FF6B81', '#2ED573'
  ];
  const index = typeof id === 'string' 
    ? parseInt(id) % colors.length 
    : id % colors.length;
  return colors[index];
};

export const getInitials = (name: string): string => {
  if (!name) return '?';
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
};