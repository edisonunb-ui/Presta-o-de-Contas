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
  driveFolderId?: string; // Mapped Google Drive folder ID (backend hidden)
}

export interface UserPermissions {
  folders_view?: boolean;
  folders_create?: boolean;
  folders_delete?: boolean;
  
  files_view?: boolean;
  files_upload?: boolean;
  files_delete?: boolean;
  
  protocols_view?: boolean;
  protocols_create?: boolean;
  protocols_reply?: boolean;
  protocols_close?: boolean;
  
  register_sindicos?: boolean;
  register_condos?: boolean;
  view_audit_logs?: boolean;
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
  permissions?: UserPermissions;
}

export interface Folder {
  id: string;
  condominiumId: string;
  year: number;
  month: number;
  name?: string;
  createdAt: string;
  driveFolderUrl?: string;
  driveFolderId?: string;
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
  driveFileId?: string; // Mapped Google Drive file ID (backend hidden)
  receiptStatus?: 'pendente' | 'confirmado';
  confirmedBy?: string;
  confirmedAt?: string;
  confirmedByUserId?: string;
  confirmationIp?: string;
  confirmationUserAgent?: string;
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
