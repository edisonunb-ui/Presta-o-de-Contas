import React, { useState } from "react";
import { collection, addDoc, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import { User, Folder, FileEntry } from "../types";
import { FolderKanban, FileText, UploadCloud, Trash2, Download, Plus, AlertCircle, FileCheck, FolderClosed, FolderOpen, Eye, Printer, ExternalLink } from "lucide-react";

interface FoldersTabProps {
  currentUser: User;
  selectedCondominiumId: string;
  folders: Folder[];
  files: FileEntry[];
  onRefresh: () => void;
  onAddAuditLog: (action: string, details: string) => void;
  condominiumName: string;
}

const MONTHS_PT = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export default function FoldersTab({
  currentUser,
  selectedCondominiumId,
  folders,
  files,
  onRefresh,
  onAddAuditLog,
  condominiumName,
}: FoldersTabProps) {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [viewingFile, setViewingFile] = useState<FileEntry | null>(null);
  const [viewingUrl, setViewingUrl] = useState<string | null>(null);
  
  // Custom Modal configuration
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    isConfirm?: boolean;
    onConfirm?: () => void;
  } | null>(null);

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setModalConfig({
      isOpen: true,
      title,
      message,
      isConfirm: true,
      onConfirm,
    });
  };

  const showAlert = (title: string, message: string) => {
    setModalConfig({
      isOpen: true,
      title,
      message,
      isConfirm: false,
    });
  };

  // Folder form
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  // File Upload
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  // Permission checks
  const hasPermission = (key: string, defaultVal: boolean) => {
    if (currentUser.role === "SuperADM") return true;
    if (currentUser.permissions && (currentUser.permissions as any)[key] !== undefined) {
      return !!(currentUser.permissions as any)[key];
    }
    return defaultVal;
  };

  const canViewFolders = hasPermission("folders_view", true);
  const canCreateOrDeleteFolders = hasPermission("folders_create", currentUser.role === "SuperADM");
  const canUploadFiles = hasPermission("files_upload", currentUser.role === "SuperADM" || currentUser.role === "Administrador");
  const canDeleteFiles = hasPermission("files_delete", currentUser.role === "SuperADM");
  const canViewFiles = hasPermission("files_view", true);

  // Filter folders for the selected condominium
  const filteredFolders = folders
    .filter((f) => f.condominiumId === selectedCondominiumId)
    .sort((a, b) => {
      const timeA = new Date(a.createdAt || 0).getTime();
      const timeB = new Date(b.createdAt || 0).getTime();
      return timeB - timeA; // Newest folders created by the user appear first!
    });

  // Filter files for the selected folder
  const filteredFiles = files.filter((file) => file.folderId === selectedFolderId);

  // Auto-select the first folder when switching condominiums or when folders list changes
  React.useEffect(() => {
    if (filteredFolders.length > 0) {
      const exists = filteredFolders.some((f) => f.id === selectedFolderId);
      if (!selectedFolderId || !exists) {
        setSelectedFolderId(filteredFolders[0].id);
      }
    } else {
      setSelectedFolderId(null);
    }
  }, [selectedCondominiumId, filteredFolders.length, selectedFolderId]);

  // Create folder
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCondominiumId) return;

    const trimmedName = newFolderName.trim();
    if (!trimmedName) return;

    // Check if folder with the same name already exists (case insensitive)
    const exists = filteredFolders.some(
      (f) => f.name?.toLowerCase() === trimmedName.toLowerCase()
    );

    if (exists) {
      showAlert("Pasta Existente", `Já existe uma pasta com o nome "${trimmedName}"!`);
      return;
    }

    try {
      // Auto-extract year if any 4-digit number exists in the name, or default to current year
      let parsedYear = new Date().getFullYear();
      const yearMatch = trimmedName.match(/\b(20\d{2})\b/);
      if (yearMatch) {
        parsedYear = parseInt(yearMatch[1]);
      }

      const docRef = await addDoc(collection(db, "pastas"), {
        condominiumId: selectedCondominiumId,
        name: trimmedName,
        year: parsedYear,
        month: 1,
        createdAt: new Date().toISOString(),
      });
      await updateDoc(doc(db, "pastas", docRef.id), { id: docRef.id });

      onAddAuditLog(
        "Criação de Pasta",
        `Criou a pasta "${trimmedName}" no condomínio ${condominiumName}`
      );

      setSelectedFolderId(docRef.id);
      setNewFolderName("");
      setIsCreatingFolder(false);
      onRefresh();
    } catch (error) {
      console.error(error);
      showAlert("Erro", "Erro ao criar pasta: " + (error instanceof Error ? error.message : String(error)));
    }
  };

  // Convert and save file to base64
  const handleFileUpload = (file: File) => {
    if (!selectedFolderId) return;
    if (file.type !== "application/pdf") {
      setUploadError("Apenas arquivos PDF são permitidos para prestação de contas.");
      return;
    }

    // Limit to 4MB inside Firestore base64 to avoid token or size limit issues
    if (file.size > 4 * 1024 * 1024) {
      setUploadError("O tamanho máximo do arquivo é de 4MB.");
      return;
    }

    setIsUploading(true);
    setUploadError("");

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64String = (reader.result as string).split(",")[1];
        
        const docRef = await addDoc(collection(db, "arquivos"), {
          folderId: selectedFolderId,
          name: file.name,
          size: file.size,
          type: file.type,
          uploadedBy: currentUser.name,
          uploadedAt: new Date().toISOString(),
          content: base64String,
        });
        await updateDoc(doc(db, "arquivos", docRef.id), { id: docRef.id });

        const folderObj = folders.find((f) => f.id === selectedFolderId);
        const folderLabel = folderObj 
          ? (folderObj.name || `${MONTHS_PT[folderObj.month - 1]}/${folderObj.year}`) 
          : selectedFolderId;
        
        onAddAuditLog(
          "Upload de Arquivo",
          `Enviou o arquivo: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB) para a pasta: ${folderLabel} do condomínio ${condominiumName}`
        );

        onRefresh();
        setIsUploading(false);
      } catch (err) {
        console.error(err);
        setUploadError("Falha ao salvar arquivo no Firestore.");
        setIsUploading(false);
      }
    };
    reader.onerror = () => {
      setUploadError("Erro ao ler o arquivo físico.");
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  // Download logic
  const handleDownloadFile = (file: FileEntry) => {
    try {
      const byteCharacters = atob(file.content);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      showAlert("Erro de Download", "Falha no download do PDF. Exibindo alternativa de texto.");
    }
  };

  // View PDF File logic
  const handleViewFile = (file: FileEntry) => {
    try {
      const byteCharacters = atob(file.content);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      setViewingFile(file);
      setViewingUrl(url);
    } catch (err) {
      console.error(err);
      showAlert("Erro de Visualização", "Não foi possível carregar a visualização do PDF.");
    }
  };

  const handleCloseViewer = () => {
    if (viewingUrl) {
      URL.revokeObjectURL(viewingUrl);
    }
    setViewingFile(null);
    setViewingUrl(null);
  };

  // Print PDF File logic
  const handlePrintFile = (file: FileEntry) => {
    try {
      const byteCharacters = atob(file.content);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      iframe.src = url;
      document.body.appendChild(iframe);
      
      iframe.onload = () => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
          URL.revokeObjectURL(url);
        }, 5000);
      };
    } catch (err) {
      console.error(err);
      showAlert("Erro de Impressão", "Falha ao preparar o arquivo para impressão.");
    }
  };

  // Delete File
  const handleDeleteFile = (id: string, name: string) => {
    if (!id) {
      showAlert("Erro", "Erro: ID do arquivo inválido ou não carregado. Atualize a página e tente novamente.");
      return;
    }
    showConfirm(
      "Confirmar Exclusão",
      `Tem certeza de que deseja excluir o arquivo "${name}"?`,
      async () => {
        try {
          await deleteDoc(doc(db, "arquivos", id));
          onAddAuditLog(
            "Exclusão de Arquivo",
            `Excluiu o arquivo: ${name} do condomínio ${condominiumName}`
          );
          onRefresh();
        } catch (err) {
          console.error(err);
          showAlert("Erro", "Erro ao excluir o arquivo do banco de dados: " + (err instanceof Error ? err.message : String(err)));
        }
      }
    );
  };

  // Delete Folder
  const handleDeleteFolder = (folderId: string, label: string) => {
    if (!folderId) {
      showAlert("Erro", "Erro: ID da pasta inválido.");
      return;
    }
    showConfirm(
      "Confirmar Exclusão",
      `Tem certeza de que deseja excluir a pasta "${label}" e TODOS os seus arquivos?`,
      async () => {
        try {
          // Delete associated files first
          const associatedFiles = files.filter(f => f.folderId === folderId);
          for (const file of associatedFiles) {
            if (file.id) {
              await deleteDoc(doc(db, "arquivos", file.id));
            }
          }
          await deleteDoc(doc(db, "pastas", folderId));

          onAddAuditLog(
            "Exclusão de Pasta",
            `Excluiu a pasta mensal: ${label} e seus arquivos associados para o condomínio ${condominiumName}`
          );

          if (selectedFolderId === folderId) {
            setSelectedFolderId(null);
          }
          onRefresh();
        } catch (err) {
          console.error(err);
          showAlert("Erro", "Erro ao excluir a pasta do banco de dados: " + (err instanceof Error ? err.message : String(err)));
        }
      }
    );
  };

  const selectedFolder = folders.find((f) => f.id === selectedFolderId);

  if (!canViewFolders) {
    return (
      <div className="bg-white p-12 border border-[#111111] text-center max-w-2xl mx-auto space-y-4">
        <FolderClosed className="w-12 h-12 text-[#C2A87E] mx-auto animate-pulse" />
        <h3 className="font-serif italic text-2xl text-[#111111]">Acesso Restrito</h3>
        <p className="text-sm text-gray-600 font-sans max-w-md mx-auto">
          Você não possui permissão para visualizar as pastas deste condomínio. Entre em contato com o administrador para solicitar acesso.
        </p>
      </div>
    );
  }

  return (
    <div id="foldersTabRoot" className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {/* Column 1: Folder list */}
      <div className="md:col-span-1 bg-white p-6 border border-[#111111] flex flex-col h-[600px] shadow-none">
        <div className="flex items-center justify-between pb-4 border-b border-[#111111] mb-6">
          <h2 className="font-serif italic text-xl text-[#111111] flex items-center gap-2">
            <FolderKanban className="w-4 h-4 text-[#111111]" /> Pastas do Condomínio
          </h2>
          {canCreateOrDeleteFolders && (
            <button
              onClick={() => setIsCreatingFolder(!isCreatingFolder)}
              className="p-1.5 border border-[#111111] bg-white hover:bg-[#F4F2EE] transition-colors cursor-pointer flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider"
              title="Criar Nova Pasta"
            >
              <Plus className="w-3.5 h-3.5 text-[#111111]" /> Criar
            </button>
          )}
        </div>

        {!canCreateOrDeleteFolders && !canUploadFiles && (
          <div className="mb-4 p-3 bg-[#EEF2F0]/80 border border-[#123E33]/20 text-left">
            <p className="text-[10px] font-sans font-bold uppercase tracking-wider text-[#123E33] flex items-center gap-1">
              <FileCheck className="w-3.5 h-3.5" /> Pasta em Evidência
            </p>
            <p className="text-[10px] text-gray-600 font-serif italic mt-1">
              Seu acesso permite visualizar, imprimir e baixar os documentos de prestação de contas deste condomínio.
            </p>
          </div>
        )}

        {isCreatingFolder && (
          <form
            onSubmit={handleCreateFolder}
            className="mb-6 p-4 border border-[#111111] bg-[#F4F2EE]/30 space-y-4"
          >
            <h4 className="font-bold text-[10px] uppercase tracking-widest text-[#111111]">Nova Pasta</h4>
            
            <div>
              <label className="block text-[9px] font-bold text-[#111111] uppercase tracking-widest mb-1.5">Nome da Pasta</label>
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Ex: Ano 2026, Prestação 2026, etc."
                className="w-full px-3 py-2 border border-[#111111] rounded-none text-sm bg-white outline-none text-[#111111]"
                required
                autoFocus
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 bg-[#111111] hover:bg-[#C2A87E] text-white text-[10px] uppercase font-bold tracking-widest py-2.5 transition-colors cursor-pointer rounded-none border border-[#111111]"
              >
                Criar
              </button>
              <button
                type="button"
                onClick={() => setIsCreatingFolder(false)}
                className="flex-1 bg-white hover:bg-gray-100 text-[#111111] text-[10px] uppercase font-bold tracking-widest py-2.5 transition-colors cursor-pointer border border-[#111111]"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {filteredFolders.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm font-serif italic">
              Nenhuma pasta criada.
            </div>
          ) : (
            filteredFolders.map((folder, index) => {
              const label = folder.name || `${MONTHS_PT[folder.month - 1]} / ${folder.year}`;
              const isSelected = folder.id === selectedFolderId;
              const fileCount = files.filter((f) => f.folderId === folder.id).length;
              const formattedIndex = String(index + 1).padStart(2, '0');

              return (
                <div
                  key={folder.id}
                  onClick={() => setSelectedFolderId(folder.id)}
                  className={`group grid grid-cols-[40px_1fr] border-b border-[#EEEEEE] h-14 items-center cursor-pointer transition-all ${
                    isSelected
                      ? "bg-[#F4F2EE] border-l-4 border-l-[#111111] text-[#111111]"
                      : "bg-[#FDFCFB]/50 hover:bg-[#F4F2EE]/30 text-gray-700"
                  }`}
                >
                  <span className="font-serif italic text-xs text-center text-[#111111]/40 group-hover:text-[#111111]">
                    {formattedIndex}
                  </span>
                  <div className="flex items-center justify-between pr-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {isSelected ? (
                        <FolderOpen className="w-5 h-5 text-[#C2A87E] shrink-0" />
                      ) : (
                        <FolderClosed className="w-5 h-5 text-[#111111]/60 group-hover:text-[#111111] shrink-0" />
                      )}
                      <div className="truncate">
                        <div className="text-xs font-bold uppercase tracking-wider truncate">{label}</div>
                        <div className="text-[10px] text-gray-500 font-serif italic">{fileCount} {fileCount === 1 ? "arquivo" : "arquivos"}</div>
                      </div>
                    </div>
                    {canCreateOrDeleteFolders && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteFolder(folder.id, label);
                        }}
                        className="text-gray-400 hover:text-red-700 p-1 transition-opacity opacity-0 group-hover:opacity-100"
                        title="Excluir Pasta"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Column 2 & 3: Selected folder files panel */}
      <div className="md:col-span-2 bg-white p-6 border border-[#111111] flex flex-col h-[600px] shadow-none">
        {selectedFolder ? (
          !canViewFiles ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-4">
              <FolderClosed className="w-12 h-12 text-[#C2A87E] mx-auto" />
              <h3 className="font-serif italic text-xl text-[#111111]">Acesso Restrito a Arquivos</h3>
              <p className="text-sm text-gray-500 font-sans max-w-sm mx-auto">
                Sua permissão de acesso não permite visualizar os arquivos e documentos digitalizados desta pasta.
              </p>
            </div>
          ) : (
            <>
            <div className="flex items-center justify-between pb-4 border-b border-[#111111]">
              <div>
                <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.2em] font-bold text-gray-400">
                  <span>Pastas</span>
                  <span>/</span>
                  <span className="text-[#C2A87E]">{selectedFolder.name || `${MONTHS_PT[selectedFolder.month - 1]} / ${selectedFolder.year}`}</span>
                </div>
                <h3 className="text-2xl font-serif italic tracking-tight text-[#111111] mt-1">
                  {selectedFolder.name || `${MONTHS_PT[selectedFolder.month - 1]} / ${selectedFolder.year}`}
                </h3>
              </div>
              <span className="border border-[#111111] bg-[#F4F2EE] text-[#111111] text-[10px] uppercase font-bold tracking-widest px-3 py-1.5 shrink-0">
                {filteredFiles.length} {filteredFiles.length === 1 ? "ARQUIVO PDF" : "ARQUIVOS PDF"}
              </span>
            </div>

            {/* Upload Zone (Administradores only) */}
            {canUploadFiles && (
              <div className="mt-4">
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleFileUpload(e.dataTransfer.files[0]);
                    }
                  }}
                  className={`border-2 border-dashed p-6 text-center transition-all relative rounded-none ${
                    dragOver
                      ? "border-[#111111] bg-[#F4F2EE]"
                      : "border-gray-300 hover:border-[#111111] hover:bg-[#F4F2EE]/40"
                  }`}
                >
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileInputChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={isUploading}
                  />
                  <div className="flex flex-col items-center justify-center">
                    <UploadCloud className={`w-8 h-8 mb-2 text-[#111111] ${isUploading ? "animate-bounce" : ""}`} />
                    <p className="text-xs font-bold uppercase tracking-wider text-[#111111]">
                      {isUploading ? "Enviando arquivo..." : "Clique ou arraste a Pasta de Prestação de Contas (PDF)"}
                    </p>
                    <p className="text-[10px] text-gray-500 font-serif italic mt-1">Formatos suportados: Apenas arquivos PDF (Máx: 4MB)</p>
                  </div>
                </div>

                {uploadError && (
                  <div className="mt-2 flex items-center gap-2 text-xs font-serif italic text-red-700 bg-red-50 p-2.5 border border-red-200">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {uploadError}
                  </div>
                )}
              </div>
            )}

            {/* List of Files */}
            <div className="flex-1 overflow-y-auto mt-6 space-y-4 pr-1">
              {filteredFiles.length === 0 ? (
                <div className="text-center py-20 text-gray-400 text-sm font-serif italic">
                  Esta pasta está vazia. Nenhum documento PDF de prestação de contas anexado.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {filteredFiles.map((file) => (
                    <div
                      key={file.id}
                      className="bg-white border border-[#111111] p-6 flex flex-col relative overflow-hidden group rounded-none"
                    >
                      {/* PDF Corner Tag */}
                      <div className="absolute top-0 right-0 p-2 bg-[#111111] text-white text-[9px] uppercase font-bold tracking-widest">
                        PDF
                      </div>

                      <div className="pr-12">
                        <h4 className="text-lg font-serif italic tracking-tight text-[#111111] truncate">{file.name}</h4>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-gray-500 font-mono mt-2">
                          <span>TAMANHO: {(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                          <span className="opacity-30">•</span>
                          <span>ENVIADO POR: {file.uploadedBy.toUpperCase()}</span>
                          <span className="opacity-30">•</span>
                          <span>DATA: {new Date(file.uploadedAt).toLocaleDateString("pt-BR")}</span>
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t border-[#111111]/10 flex flex-wrap items-center justify-end gap-2">
                        <button
                          onClick={() => handleViewFile(file)}
                          className="px-3.5 py-2 border border-[#111111] bg-white hover:bg-[#F4F2EE] text-[10px] uppercase font-bold tracking-widest transition-all cursor-pointer flex items-center gap-1.5"
                          title="Visualizar documento PDF na tela"
                        >
                          <Eye className="w-3.5 h-3.5" /> Visualizar
                        </button>

                        <button
                          onClick={() => handleDownloadFile(file)}
                          className="px-3.5 py-2 border border-[#111111] bg-white hover:bg-[#F4F2EE] text-[10px] uppercase font-bold tracking-widest transition-all cursor-pointer flex items-center gap-1.5"
                          title="Fazer download do arquivo PDF"
                        >
                          <Download className="w-3.5 h-3.5" /> Baixar
                        </button>

                        <button
                          onClick={() => handlePrintFile(file)}
                          className="px-3.5 py-2 border border-[#111111] bg-white hover:bg-[#F4F2EE] text-[10px] uppercase font-bold tracking-widest transition-all cursor-pointer flex items-center gap-1.5"
                          title="Imprimir documento PDF"
                        >
                          <Printer className="w-3.5 h-3.5" /> Imprimir
                        </button>

                        {canDeleteFiles && (
                          <button
                            onClick={() => handleDeleteFile(file.id, file.name)}
                            className="px-3.5 py-2 border border-red-700 text-red-700 hover:bg-red-50 text-[10px] uppercase font-bold tracking-widest transition-all cursor-pointer flex items-center gap-1.5"
                            title="Excluir arquivo permanentemente"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Excluir
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            </>
          )
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-400 p-8">
            <div className="p-4 bg-[#F4F2EE] border border-[#111111] mb-4 text-[#111111]">
              <FileText className="w-12 h-12" />
            </div>
            <h3 className="text-xl font-serif italic text-[#111111]">Selecione uma pasta</h3>
            <p className="text-xs max-w-xs mt-2 leading-relaxed">
              Escolha uma pasta na lista à esquerda para visualizar, enviar ou fazer o download dos arquivos PDF de prestação de contas.
            </p>
          </div>
        )}
      </div>

      {/* Custom Confirmation / Alert Modal */}
      {modalConfig && modalConfig.isOpen && (
        <div id="customModal" className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/45 backdrop-blur-xs transition-opacity"
            onClick={() => setModalConfig(null)}
          />
          <div className="relative bg-[#FAF9F6] border border-[#111111] p-6 max-w-md w-full shadow-lg z-10">
            <h3 className="font-serif italic text-xl text-[#111111] border-b border-[#111111]/10 pb-3 mb-4">
              {modalConfig.title}
            </h3>
            <p className="text-sm text-gray-700 leading-relaxed font-sans mb-6">
              {modalConfig.message}
            </p>
            <div className="flex items-center justify-end gap-3">
              {modalConfig.isConfirm ? (
                <>
                  <button
                    onClick={() => setModalConfig(null)}
                    className="px-4 py-2 bg-white hover:bg-gray-100 text-[#111111] text-xs uppercase font-bold tracking-widest border border-[#111111] transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      if (modalConfig.onConfirm) modalConfig.onConfirm();
                      setModalConfig(null);
                    }}
                    className="px-4 py-2 bg-[#111111] hover:bg-[#C2A87E] text-white text-xs uppercase font-bold tracking-widest border border-[#111111] transition-colors cursor-pointer"
                  >
                    Confirmar
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setModalConfig(null)}
                  className="px-4 py-2 bg-[#111111] hover:bg-[#C2A87E] text-white text-xs uppercase font-bold tracking-widest border border-[#111111] transition-colors cursor-pointer"
                >
                  OK
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VISUALIZAR PDF */}
      {viewingFile && viewingUrl && (
        <div id="viewPdfModal" className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={handleCloseViewer}
          />
          <div className="relative bg-[#FAF9F6] border border-[#111111] p-6 max-w-5xl w-full h-[90vh] flex flex-col shadow-2xl z-10 space-y-4">
            <div className="border-b border-[#111111]/10 pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <span className="text-[9px] uppercase tracking-[0.2em] font-bold text-gray-400 block">
                  Visualização de Documento
                </span>
                <h3 className="font-serif italic text-lg text-[#111111] truncate max-w-sm sm:max-w-md md:max-w-lg mt-0.5" title={viewingFile.name}>
                  {viewingFile.name}
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={viewingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-[#123E33] hover:bg-[#1c5d4d] text-white text-[10px] uppercase font-bold tracking-widest transition-all cursor-pointer flex items-center gap-1.5 no-underline border border-[#123E33]"
                  title="Abrir visualização do PDF em uma nova aba do navegador"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Abrir em Nova Guia
                </a>
                <button
                  onClick={() => handlePrintFile(viewingFile)}
                  className="px-3 py-1.5 border border-[#111111] bg-white hover:bg-[#F4F2EE] text-[10px] uppercase font-bold tracking-widest transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" /> Imprimir
                </button>
                <button
                  onClick={() => handleDownloadFile(viewingFile)}
                  className="px-3 py-1.5 border border-[#111111] bg-white hover:bg-[#F4F2EE] text-[10px] uppercase font-bold tracking-widest transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" /> Baixar
                </button>
                <button
                  onClick={handleCloseViewer}
                  className="px-3 py-1.5 bg-[#111111] hover:bg-stone-800 text-white border border-[#111111] text-[10px] uppercase font-bold tracking-widest transition-all cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>

            {/* Banner explicativo sobre bloqueio de iframe do navegador */}
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-left flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-[10px] leading-relaxed">
                <strong className="uppercase tracking-wider">Dica do Navegador:</strong> Se o documento PDF exibir um erro ou não carregar abaixo devido às restrições de segurança do iframe do AI Studio, clique no botão verde <strong className="font-sans font-bold">"ABRIR EM NOVA GUIA"</strong> acima para visualizar e imprimir nativamente com total compatibilidade.
              </div>
            </div>

            <div className="flex-1 bg-stone-100 border border-[#111111]/20 relative overflow-hidden">
              <iframe
                src={viewingUrl}
                className="w-full h-full border-none"
                title={viewingFile.name}
              />
            </div>
            
            <p className="text-[10px] text-gray-400 font-serif italic text-right">
              Tamanho: {(viewingFile.size / (1024 * 1024)).toFixed(2)} MB • Enviado por: {viewingFile.uploadedBy.toUpperCase()} • Data: {new Date(viewingFile.uploadedAt).toLocaleDateString("pt-BR")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
