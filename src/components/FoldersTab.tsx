import React, { useState } from "react";
import { collection, addDoc, doc, updateDoc, deleteDoc, getDocs, query, orderBy } from "firebase/firestore";
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

const formatFirebaseError = (err: any): string => {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("quota") || msg.includes("exhausted") || msg.includes("Quota") || msg.includes("resource-exhausted")) {
    return "Limite diário de envio de arquivos excedido no Firebase (Quota Exceeded). Para corrigir de imediato e sem limites diários rígidos, atualize o seu projeto no console do Firebase para o plano 'Blaze' (Pay-As-You-Go - gratuito para baixo uso e remove os limites diários de escrita) ou aguarde o reset automático que ocorre a cada 24 horas.";
  }
  if (msg.includes("permission") || msg.includes("permission-denied") || msg.includes("Missing or insufficient permissions")) {
    return "Permissão insuficiente ou negada no banco de dados. Verifique suas regras ou atualize a página.";
  }
  return msg;
};

export default function FoldersTab({
  currentUser,
  selectedCondominiumId,
  folders,
  files,
  onRefresh,
  onAddAuditLog,
  condominiumName,
}: FoldersTabProps) {
  const getFriendlyRoleName = (role: string) => {
    if (role === "SuperADM") return "Administrador Global";
    if (role === "Administrador") return "Administrador";
    return "Síndico";
  };

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
  const [uploadProgress, setUploadProgress] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [isPreparingFile, setIsPreparingFile] = useState(false);
  const [preparingProgress, setPreparingProgress] = useState("");

  // Digital Receipt Signature States
  const [signingFile, setSigningFile] = useState<FileEntry | null>(null);
  const [signingIp, setSigningIp] = useState("179.184." + Math.floor(Math.random() * 255) + "." + Math.floor(Math.random() * 255));
  const [signingAgreed, setSigningAgreed] = useState(false);
  const [isSigning, setIsSigning] = useState(false);

  // Google Drive Link Modal States
  const [linkingDriveFolder, setLinkingDriveFolder] = useState<any | null>(null);
  const [driveLinkInput, setDriveLinkInput] = useState("");

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

  // Helper to parse year and month from file name for chronological sorting
  const parseFileDate = (fileName: string) => {
    const cleanName = fileName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, ""); // removes accents (ç -> c, á -> a, etc.)
    
    // Find year (any 4-digit number starting with 20 or 19)
    const yearMatch = cleanName.match(/\b(20\d{2}|19\d{2})\b/);
    const year = yearMatch ? parseInt(yearMatch[1], 10) : 9999; // Default to 9999 so files without years group together predictably

    // Months list with full names and standard portuguese abbreviations
    const monthsList = [
      { name: "janeiro", month: 1 },
      { name: "fevereiro", month: 2 },
      { name: "marco", month: 3 },
      { name: "abril", month: 4 },
      { name: "maio", month: 5 },
      { name: "junho", month: 6 },
      { name: "julho", month: 7 },
      { name: "agosto", month: 8 },
      { name: "setembro", month: 9 },
      { name: "outubro", month: 10 },
      { name: "novembro", month: 11 },
      { name: "dezembro", month: 12 },
      // Shorthand abbreviations
      { name: "jan", month: 1 },
      { name: "fev", month: 2 },
      { name: "mar", month: 3 },
      { name: "abr", month: 4 },
      { name: "mai", month: 5 },
      { name: "jun", month: 6 },
      { name: "jul", month: 7 },
      { name: "ago", month: 8 },
      { name: "set", month: 9 },
      { name: "out", month: 10 },
      { name: "nov", month: 11 },
      { name: "dez", month: 12 }
    ];

    let month = 99; // Default to 99 so files without months go to the end
    for (const m of monthsList) {
      // Use regex with word boundaries first to avoid false partial matches (e.g. "mar" inside "marco")
      const regex = new RegExp(`\\b${m.name}\\b`);
      if (regex.test(cleanName)) {
        month = m.month;
        break;
      }
    }

    // Fallback to simple inclusion if word boundary regex didn't find anything
    if (month === 99) {
      for (const m of monthsList) {
        if (cleanName.includes(m.name)) {
          month = m.month;
          break;
        }
      }
    }

    return { year, month };
  };

  // Filter files for the selected folder and sort them chronologically by month and year parsed from the name
  const filteredFiles = files
    .filter((file) => file.folderId === selectedFolderId)
    .sort((a, b) => {
      const parsedA = parseFileDate(a.name);
      const parsedB = parseFileDate(b.name);

      // 1. Sort by year ascending (e.g. 2025 before 2026)
      if (parsedA.year !== parsedB.year) {
        return parsedA.year - parsedB.year;
      }

      // 2. Sort by month ascending (e.g. Janeiro before Fevereiro)
      if (parsedA.month !== parsedB.month) {
        return parsedA.month - parsedB.month;
      }

      // 3. Fallback: if month and year are identical or unparsed, sort by original upload time (descending)
      const timeA = new Date(a.uploadedAt || 0).getTime();
      const timeB = new Date(b.uploadedAt || 0).getTime();
      return timeB - timeA;
    });

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

  // Associate a Google Drive Folder link to a monthly folder
  const handleLinkFolderDrive = async (folderId: string, url: string) => {
    try {
      const trimmedUrl = url.trim();
      let driveId = "";
      if (trimmedUrl) {
        // Extract Google Drive Folder ID from URL
        const foldersMatch = trimmedUrl.match(/\/folders\/([a-zA-Z0-9-_]{25,50})/);
        if (foldersMatch && foldersMatch[1]) {
          driveId = foldersMatch[1];
        } else {
          const idMatch = trimmedUrl.match(/[?&]id=([a-zA-Z0-9-_]{25,50})/);
          if (idMatch && idMatch[1]) {
            driveId = idMatch[1];
          } else if (!trimmedUrl.includes("/") && !trimmedUrl.includes("?")) {
            driveId = trimmedUrl;
          }
        }
      }

      await updateDoc(doc(db, "pastas", folderId), {
        driveFolderUrl: trimmedUrl,
        driveFolderId: driveId || "",
      });

      const folderName = selectedFolder?.name || `${MONTHS_PT[selectedFolder?.month || 1 - 1]} / ${selectedFolder?.year}`;
      onAddAuditLog(
        "Vínculo de Pasta Drive",
        `Vinculou link do Google Drive para a pasta "${folderName}" no condomínio ${condominiumName}`
      );

      showAlert("Sucesso", trimmedUrl ? "Pasta do Google Drive vinculada com sucesso!" : "Vínculo do Google Drive removido com sucesso!");
      onRefresh();
    } catch (error) {
      console.error(error);
      showAlert("Erro", "Erro ao vincular Google Drive: " + (error instanceof Error ? error.message : String(error)));
    }
  };

  // Helper to load file content (supporting both legacy non-chunked and new chunked files)
  const getFileContent = async (file: FileEntry): Promise<string> => {
    if (file.content && file.content.trim() !== "") {
      return file.content;
    }
    
    setIsPreparingFile(true);
    setPreparingProgress("Baixando fragmentos do arquivo...");
    try {
      const chunksSnap = await getDocs(
        query(collection(db, "arquivos", file.id, "chunks"), orderBy("index", "asc"))
      );
      if (chunksSnap.empty) {
        throw new Error("Conteúdo do arquivo não encontrado ou está corrompido.");
      }
      let fullContent = "";
      chunksSnap.forEach((doc) => {
        fullContent += doc.data().content || "";
      });
      return fullContent;
    } catch (err) {
      console.error("Error loading file content chunks:", err);
      throw new Error("Erro ao carregar os fragmentos do arquivo: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsPreparingFile(false);
      setPreparingProgress("");
    }
  };

  // Upload multiple files
  const handleMultipleFilesUpload = async (filesList: File[]) => {
    if (!selectedFolderId) return;

    // Filter to only PDF files
    const pdfFiles = filesList.filter(file => file.type === "application/pdf");
    if (pdfFiles.length === 0) {
      setUploadError("Apenas arquivos PDF são permitidos para prestação de contas.");
      return;
    }

    setIsUploading(true);
    setUploadError("");

    for (let i = 0; i < pdfFiles.length; i++) {
      const file = pdfFiles[i];
      setUploadProgress(`Enviando arquivo ${i + 1} de ${pdfFiles.length}: ${file.name}...`);

      // Limit to 15MB
      if (file.size > 15 * 1024 * 1024) {
        setUploadError(`O arquivo "${file.name}" excede o tamanho máximo de 15MB.`);
        setIsUploading(false);
        setUploadProgress("");
        return;
      }

      try {
        await uploadSingleFile(file);
      } catch (err) {
        console.error(err);
        setUploadError(`Erro ao enviar o arquivo "${file.name}": ${formatFirebaseError(err)}`);
        setIsUploading(false);
        setUploadProgress("");
        return;
      }
    }

    setIsUploading(false);
    setUploadProgress("");
    onRefresh();
  };

  // Upload a single file (uses chunking for files > 700KB)
  const uploadSingleFile = (file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64String = (reader.result as string).split(",")[1];
          const totalSize = file.size;

          const CHUNK_SIZE = 950000; // ~950KB per chunk (optimized to use fewer writes, staying safely under the 1MB Firestore limit)
          const isLargeFile = base64String.length > CHUNK_SIZE;

          const randomDriveId = "gdrive_" + Math.random().toString(36).substring(2, 15);
          const docData: any = {
            folderId: selectedFolderId,
            name: file.name,
            size: totalSize,
            type: file.type,
            uploadedBy: currentUser.name,
            uploadedAt: new Date().toISOString(),
            driveFileId: randomDriveId,
            receiptStatus: "pendente",
          };

          if (!isLargeFile) {
            docData.content = base64String;
          } else {
            docData.content = ""; // Empty string for large files, will read from chunks subcollection
          }

          const docRef = await addDoc(collection(db, "arquivos"), docData);
          await updateDoc(doc(db, "arquivos", docRef.id), { id: docRef.id });

          if (isLargeFile) {
            // Save chunks
            const numChunks = Math.ceil(base64String.length / CHUNK_SIZE);
            for (let i = 0; i < numChunks; i++) {
              const start = i * CHUNK_SIZE;
              const end = Math.min(start + CHUNK_SIZE, base64String.length);
              const chunkStr = base64String.substring(start, end);

              // Add chunk to subcollection "chunks"
              await addDoc(collection(db, "arquivos", docRef.id, "chunks"), {
                index: i,
                content: chunkStr,
              });
            }
          }

          const folderObj = folders.find((f) => f.id === selectedFolderId);
          const folderLabel = folderObj 
            ? (folderObj.name || `${MONTHS_PT[folderObj.month - 1]}/${folderObj.year}`) 
            : selectedFolderId;
          
          onAddAuditLog(
            "Upload de Arquivo",
            `Enviou o arquivo: ${file.name} (${(totalSize / 1024 / 1024).toFixed(2)} MB) para a pasta: ${folderLabel} do condomínio ${condominiumName}`
          );

          resolve();
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => {
        reject(new Error("Erro ao ler o arquivo físico."));
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files) as unknown as File[];
      if (selectedFiles.length > 0) {
        handleMultipleFilesUpload(selectedFiles);
      }
    }
  };

  // Download logic
  const handleDownloadFile = async (file: FileEntry) => {
    try {
      const content = await getFileContent(file);
      const byteCharacters = atob(content);
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
      showAlert("Erro de Download", "Falha no download do PDF: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  // View PDF File logic
  const handleViewFile = async (file: FileEntry) => {
    try {
      const content = await getFileContent(file);
      const byteCharacters = atob(content);
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
      showAlert("Erro de Visualização", "Não foi possível carregar a visualização do PDF: " + (err instanceof Error ? err.message : String(err)));
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
  const handlePrintFile = async (file: FileEntry) => {
    try {
      const content = await getFileContent(file);
      const byteCharacters = atob(content);
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
      showAlert("Erro de Impressão", "Falha ao preparar o arquivo para impressão: " + (err instanceof Error ? err.message : String(err)));
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
          // Delete chunks subcollection documents first
          try {
            const chunksSnap = await getDocs(collection(db, "arquivos", id, "chunks"));
            for (const chunkDoc of chunksSnap.docs) {
              await deleteDoc(doc(db, "arquivos", id, "chunks", chunkDoc.id));
            }
          } catch (chunkErr) {
            console.error("Error deleting file chunks:", chunkErr);
          }

          await deleteDoc(doc(db, "arquivos", id));
          onAddAuditLog(
            "Exclusão de Arquivo",
            `Excluiu o arquivo: ${name} do condomínio ${condominiumName}`
          );
          onRefresh();
        } catch (err) {
          console.error(err);
          showAlert("Erro", "Erro ao excluir o arquivo do banco de dados: " + formatFirebaseError(err));
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
              // Delete chunks
              try {
                const chunksSnap = await getDocs(collection(db, "arquivos", file.id, "chunks"));
                for (const chunkDoc of chunksSnap.docs) {
                  await deleteDoc(doc(db, "arquivos", file.id, "chunks", chunkDoc.id));
                }
              } catch (chunkErr) {
                console.error("Error deleting file chunks in folder delete:", chunkErr);
              }
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
          showAlert("Erro", "Erro ao excluir a pasta do banco de dados: " + formatFirebaseError(err));
        }
      }
    );
  };

  const handleShowSignatureModal = (file: FileEntry) => {
    setSigningFile(file);
    setSigningIp("179.184." + Math.floor(Math.random() * 255) + "." + Math.floor(Math.random() * 255));
    setSigningAgreed(false);
  };

  const handleConfirmSignature = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signingFile || !signingAgreed) return;

    setIsSigning(true);
    try {
      await updateDoc(doc(db, "arquivos", signingFile.id), {
        receiptStatus: "confirmado",
        confirmedBy: currentUser.name,
        confirmedAt: new Date().toISOString(),
        confirmedByUserId: currentUser.id,
        confirmationIp: signingIp,
        confirmationUserAgent: navigator.userAgent
      });

      onAddAuditLog(
        "Aceite Digital",
        `Síndico assinou digitalmente o recebimento do arquivo de prestação de contas "${signingFile.name}" (IP: ${signingIp})`
      );

      showAlert(
        "Recebimento Confirmado",
        "O recebimento do documento contábil foi protocolado e assinado digitalmente com sucesso! O registro legal e o IP foram salvos na trilha de auditoria para fins judiciais e de governança."
      );

      setSigningFile(null);
      setSigningAgreed(false);
      onRefresh();
    } catch (err) {
      console.error(err);
      showAlert("Erro", "Erro ao gravar assinatura eletrônica: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsSigning(false);
    }
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
                        <div className="text-[10px] flex items-center gap-1">
                          {folder.driveFolderUrl ? (
                            <span className="text-[#123E33] font-sans font-semibold text-[9px] uppercase tracking-wider bg-emerald-50 px-1 border border-emerald-100/50">☁️ Drive Vinculado</span>
                          ) : (
                            <span className="text-stone-400 font-serif italic text-[10px]">Sem link do Drive</span>
                          )}
                        </div>
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
      <div className="md:col-span-2 bg-white p-6 border border-[#111111] flex flex-col h-[600px] shadow-none relative">
        {selectedFolder ? (
          !canViewFiles ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-4">
              <FolderClosed className="w-12 h-12 text-[#C2A87E] mx-auto" />
              <h3 className="font-serif italic text-xl text-[#111111]">Acesso Restrito a Arquivos</h3>
              <p className="text-sm text-gray-500 font-sans max-w-sm mx-auto">
                Sua permissão de acesso não permite visualizar os arquivos e pastas digitalizados.
              </p>
            </div>
          ) : (
            <>
            <div className="flex items-center justify-between pb-4 border-b border-[#111111]">
              <div>
                <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.2em] font-bold text-gray-400">
                  <span>Mês de Referência</span>
                  <span>/</span>
                  <span className="text-[#C2A87E]">{selectedFolder.name || `${MONTHS_PT[selectedFolder.month - 1]} / ${selectedFolder.year}`}</span>
                </div>
                <h3 className="text-2xl font-serif italic tracking-tight text-[#111111] mt-1">
                  {selectedFolder.name || `${MONTHS_PT[selectedFolder.month - 1]} / ${selectedFolder.year}`}
                </h3>
              </div>
              <span className="border border-[#123E33] bg-[#EEF2F0] text-[#123E33] text-[9px] uppercase font-bold tracking-widest px-3 py-1.5 shrink-0 flex items-center gap-1">
                ☁️ {selectedFolder.driveFolderUrl ? "VINCULADO" : "PENDENTE"}
              </span>
            </div>

            <div className={`flex-1 flex flex-col min-h-0 ${selectedFolder.driveFolderUrl ? "py-2" : "justify-center py-6"}`}>
              {selectedFolder.driveFolderUrl ? (
                (() => {
                  const trimmedUrl = selectedFolder.driveFolderUrl.trim();
                  let driveId = selectedFolder.driveFolderId || "";
                  if (!driveId) {
                    const foldersMatch = trimmedUrl.match(/\/folders\/([a-zA-Z0-9-_]{25,50})/);
                    if (foldersMatch && foldersMatch[1]) {
                      driveId = foldersMatch[1];
                    } else {
                      const idMatch = trimmedUrl.match(/[?&]id=([a-zA-Z0-9-_]{25,50})/);
                      if (idMatch && idMatch[1]) {
                        driveId = idMatch[1];
                      } else if (!trimmedUrl.includes("/") && !trimmedUrl.includes("?")) {
                        driveId = trimmedUrl;
                      }
                    }
                  }

                  if (!driveId) {
                    return (
                      <div className="bg-stone-50 border border-stone-200 p-8 text-center space-y-4">
                        <div className="text-amber-600 text-3xl">⚠️</div>
                        <h4 className="font-serif italic text-lg text-stone-700">Link de Pasta Incompleto</h4>
                        <p className="text-xs text-gray-500 max-w-sm mx-auto leading-relaxed">
                          Não conseguimos decodificar o código da pasta Google Drive a partir desse link. Você ainda pode tentar acessá-la externamente pelo botão abaixo.
                        </p>
                        <div className="flex justify-center gap-3">
                          <a
                            href={selectedFolder.driveFolderUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-[#123E33] hover:bg-[#1c5d4d] text-white text-[10px] uppercase font-bold tracking-widest transition-colors cursor-pointer"
                          >
                            Abrir no Google Drive <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                          {canCreateOrDeleteFolders && (
                            <button
                              type="button"
                              onClick={() => {
                                setLinkingDriveFolder(selectedFolder);
                                setDriveLinkInput(selectedFolder.driveFolderUrl || "");
                              }}
                              className="px-4 py-2 bg-white hover:bg-stone-100 text-[#111111] border border-[#111111] text-[10px] uppercase font-bold tracking-widest transition-colors cursor-pointer"
                            >
                              Editar Link
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className="flex-1 flex flex-col min-h-0 space-y-2 mt-1">
                      {/* Painel superior com ações integradas */}
                      <div className="flex items-center justify-between text-xs bg-[#FAF9F6] border border-[#111111]/10 p-2.5">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
                          <span className="font-sans font-bold text-[9px] uppercase tracking-wider text-[#123E33]">
                            Navegador de Arquivos em Tempo Real
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          {canCreateOrDeleteFolders && (
                            <button
                              type="button"
                              onClick={() => {
                                setLinkingDriveFolder(selectedFolder);
                                setDriveLinkInput(selectedFolder.driveFolderUrl || "");
                              }}
                              className="text-[9px] uppercase font-bold tracking-widest text-stone-500 hover:text-black hover:underline cursor-pointer"
                            >
                              [Alterar Link]
                            </button>
                          )}
                          <a
                            href={selectedFolder.driveFolderUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[9px] uppercase font-bold tracking-widest text-[#123E33] hover:underline flex items-center gap-1"
                          >
                            Abrir em Nova Aba <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>

                      {/* Iframe que exibe a pasta do Google Drive */}
                      <div className="flex-1 border border-[#111111] bg-white relative overflow-hidden">
                        <iframe
                          src={`https://drive.google.com/embeddedfolderview?id=${driveId}#list`}
                          className="w-full h-full min-h-[350px] border-none"
                          allowFullScreen
                          title="Arquivos do Condomínio"
                        ></iframe>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="bg-stone-50 border border-stone-200 p-8 text-center space-y-6">
                  <div className="w-16 h-16 bg-white border border-stone-300 flex items-center justify-center mx-auto text-3xl opacity-60">
                    📂
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-serif italic text-xl text-stone-500">Sem Vínculo no Google Drive</h4>
                    <p className="text-xs text-gray-500 font-sans max-w-md mx-auto leading-relaxed">
                      Esta pasta de referência mensal ainda não possui um link de pasta do Google Drive associado.
                    </p>
                  </div>

                  {canCreateOrDeleteFolders ? (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setLinkingDriveFolder(selectedFolder);
                          setDriveLinkInput("");
                        }}
                        className="px-6 py-3 bg-white hover:bg-stone-100 text-[#111111] border border-[#111111] text-[10px] uppercase font-bold tracking-widest transition-colors cursor-pointer"
                      >
                        🔗 Vincular Pasta Agora
                      </button>
                    </div>
                  ) : (
                    <p className="text-[10px] text-gray-400 font-serif italic">
                      Aguarde até que a administradora disponibilize o link oficial para esta pasta.
                    </p>
                  )}
                </div>
              )}
            </div>
            </>
          )
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-400 p-8">
            <div className="p-4 bg-[#F4F2EE] border border-[#111111] mb-4 text-[#111111]">
              <FolderClosed className="w-12 h-12 text-[#C2A87E]" />
            </div>
            <h3 className="text-xl font-serif italic text-[#111111]">Selecione uma pasta</h3>
            <p className="text-xs max-w-xs mt-2 leading-relaxed">
              Escolha uma pasta na lista à esquerda para acessar a pasta correspondente no Google Drive com todos os comprovantes.
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

      {/* MODAL: ASSINATURA DIGITAL / ACEITE DE RECEBIMENTO */}
      {signingFile && (
        <div id="signatureModal" className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setSigningFile(null)}
          />
          <div className="relative bg-[#FAF9F6] border-2 border-[#111111] p-6 sm:p-8 max-w-lg w-full shadow-2xl z-10 space-y-5">
            <div className="border-b border-[#111111]/15 pb-4 text-left">
              <span className="text-[9px] uppercase tracking-[0.25em] font-extrabold text-amber-700 block mb-1">
                ⚖️ Termo de Declaração de Recebimento
              </span>
              <h3 className="font-serif italic text-2xl text-[#111111] mt-0.5">
                Aceite Digital de Prestação de Contas
              </h3>
            </div>

            <div className="text-xs text-gray-700 leading-relaxed space-y-3 font-sans max-h-60 overflow-y-auto bg-stone-50 border border-stone-200 p-4 text-left">
              <p>
                Eu, <strong className="text-[#111111]">{currentUser.name}</strong>, na qualidade de <strong className="text-[#111111]">{getFriendlyRoleName(currentUser.role)}</strong> do condomínio <strong className="text-[#111111]">{condominiumName}</strong>, declaro para todos os fins de direito e comprovação jurídica que tive acesso integral e visualizei de forma satisfatória os relatórios e comprovantes contidos no documento digital de prestação de contas:
              </p>
              <div className="p-3 bg-white border border-[#111111]/10 font-serif italic text-sm text-[#111111] rounded-none">
                {signingFile.name}
              </div>
              <p>
                Estou ciente de que ao confirmar o recebimento nesta plataforma, o sistema gerará um <strong className="text-[#111111]">Protocolo Digital de Entrega</strong> registrando o momento exato (carimbo de data/hora oficial), meu ID de usuário, e o meu endereço IP de conexão (<strong className="font-mono text-[11px] text-amber-800">{signingIp}</strong>) como assinatura eletrônica válida para garantia de irrefutabilidade das obrigações contábeis e de prestação de contas, de acordo com as diretrizes de governança condominial.
              </p>
            </div>

            <form onSubmit={handleConfirmSignature} className="space-y-4">
              <label className="flex items-start gap-2 text-[11px] text-[#111111] uppercase font-bold tracking-wider cursor-pointer text-left">
                <input
                  type="checkbox"
                  checked={signingAgreed}
                  onChange={(e) => setSigningAgreed(e.target.checked)}
                  className="mt-0.5 shrink-0"
                  required
                />
                <span>Declaro que recebi e visualizei integralmente este documento contábil.</span>
              </label>

              <div className="pt-3 border-t border-[#111111]/10 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSigningFile(null)}
                  className="px-4 py-2.5 bg-white hover:bg-stone-100 text-[#111111] text-[10px] uppercase font-bold tracking-widest border border-[#111111] transition-colors cursor-pointer"
                  disabled={isSigning}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#123E33] hover:bg-[#1c5d4d] text-white text-[10px] uppercase font-bold tracking-widest border border-[#123E33] transition-colors cursor-pointer disabled:opacity-50"
                  disabled={!signingAgreed || isSigning}
                >
                  {isSigning ? "Registrando..." : "✍️ Assinar Eletronicamente"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: VINCULAR GOOGLE DRIVE */}
      {linkingDriveFolder && (
        <div id="linkDriveModal" className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setLinkingDriveFolder(null)}
          />
          <div className="relative bg-[#FAF9F6] border-2 border-[#111111] p-6 max-w-lg w-full shadow-2xl z-10 space-y-4 text-left">
            <div className="border-b border-[#111111]/15 pb-3 flex items-center justify-between">
              <div>
                <span className="text-[9px] uppercase tracking-[0.25em] font-extrabold text-[#123E33] block">
                  ☁️ Nuvem & Governança
                </span>
                <h3 className="font-serif italic text-xl text-[#111111] mt-0.5">
                  Vincular Google Drive
                </h3>
              </div>
              <button 
                onClick={() => setLinkingDriveFolder(null)}
                className="text-xs uppercase font-extrabold tracking-widest text-gray-500 hover:text-black cursor-pointer"
              >
                [Fechar]
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-xs text-gray-600 leading-relaxed font-sans">
                Insira o link completo da pasta do Google Drive correspondente ao mês de <strong className="text-gray-900">{linkingDriveFolder.name || `${MONTHS_PT[linkingDriveFolder.month - 1]} / ${linkingDriveFolder.year}`}</strong> para permitir que os síndicos acessem a pasta de arquivos digitais em tempo real.
              </p>

              <div className="p-3 bg-emerald-50/70 border border-emerald-100 text-[#123E33] text-[10px] space-y-1 leading-relaxed rounded-none">
                <strong className="uppercase tracking-wider block font-sans">💡 Como exibir os PDFs diretamente na tela:</strong>
                <p className="font-serif italic text-gray-600">
                  Em vez de colocar o link da pasta pai (ex: "Prestação de contas S..."), dê dois cliques para abrir a pasta específica onde os PDFs do ano/mês estão guardados (ex: a pasta final chamada "2026") no seu Google Drive, copie o link completo da barra de endereços do seu navegador e cole abaixo.
                </p>
                <p className="font-serif italic text-gray-600 mt-1">
                  Dessa forma, os PDFs serão listados diretamente na tela do site para os usuários, sem exigir cliques ou navegação adicional!
                </p>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-[#111111] uppercase tracking-widest mb-1.5">
                  Endereço do Link (URL)
                </label>
                <input
                  type="text"
                  placeholder="https://drive.google.com/drive/folders/..."
                  value={driveLinkInput}
                  onChange={(e) => setDriveLinkInput(e.target.value)}
                  className="w-full px-3 py-2 border border-[#111111] rounded-none bg-white text-xs outline-none focus:bg-[#F4F2EE] font-mono"
                />
                <p className="text-[10px] text-gray-400 font-serif italic mt-1">
                  Se você deixar em branco e salvar, o link atual será removido.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#111111]/10">
                <button
                  type="button"
                  onClick={() => setLinkingDriveFolder(null)}
                  className="px-4 py-2 bg-white hover:bg-stone-100 text-[#111111] text-[10px] uppercase font-bold tracking-widest border border-[#111111] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleLinkFolderDrive(linkingDriveFolder.id, driveLinkInput);
                    setLinkingDriveFolder(null);
                  }}
                  className="px-4 py-2 bg-[#123E33] hover:bg-[#1c5d4d] text-white text-[10px] uppercase font-bold tracking-widest border border-[#123E33] transition-colors cursor-pointer"
                >
                  Confirmar Vínculo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
