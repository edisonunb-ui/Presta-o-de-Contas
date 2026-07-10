export interface Administradora {
  id: string;
  name: string;
  createdAt: string;
}

export interface Condominium {
  id: string;
  name: string;
  administradoraId: string;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  password?: string;
  name: string;
  role: 'SuperADM' | 'Administrador' | 'Sindico';
  administradoraId?: string; // link to Administradora (for Administrador and Sindico)
  condominiumIds?: string[]; // link to Condominium IDs (especially for Sindico)
  createdAt: string;
  firstAccess?: boolean; // force password change on first login
}

export interface Folder {
  id: string;
  condominiumId: string;
  year: number;
  month: number;
  createdAt: string;
}

export interface FileEntry {
  id: string;
  folderId: string;
  name: string;
  size: number;
  type: string;
  uploadedBy: string;
  uploadedAt: string;
  content: string; // Base64 encoding of PDF content
}

export interface Protocol {
  id: string;
  condominiumId: string;
  subject: string;
  description: string;
  direction: 'administradora_para_sindico' | 'sindico_para_administradora';
  priority: 'normal' | 'alta' | 'urgente';
  status: 'aberto' | 'respondido' | 'encerrado';
  createdAt: string;
  closedAt?: string;
}

export interface Message {
  id: string;
  protocolId: string;
  senderName: string;
  senderRole: string;
  message: string;
  createdAt: string;
  fileUrl?: string; // Base64 if attached
  fileName?: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  details: string;
  createdAt: string;
}
