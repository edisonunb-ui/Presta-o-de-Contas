import React, { useState } from "react";
import { collection, addDoc, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import { User, Folder, FileEntry } from "../types";
import { FolderKanban, FileText, UploadCloud, Trash2, Download, Plus, AlertCircle, FileCheck } from "lucide-react";

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
  
  // Folder form
  const [newFolderYear, setNewFolderYear] = useState<number>(new Date().getFullYear());
  const [newFolderMonth, setNewFolderMonth] = useState<number>(new Date().getMonth() + 1);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  // File Upload
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  // Permission checks
  const canModify = currentUser.role === "SuperADM" || currentUser.role === "Administrador";

  // Filter folders for the selected condominium
  const filteredFolders = folders
    .filter((f) => f.condominiumId === selectedCondominiumId)
    .sort((a, b) => b.year - a.year || b.month - a.month);

  // Filter files for the selected folder
  const filteredFiles = files.filter((file) => file.folderId === selectedFolderId);

  // Create folder
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCondominiumId) return;

    // Check if folder for same year and month already exists
    const exists = filteredFolders.some(
      (f) => f.year === newFolderYear && f.month === newFolderMonth
    );
    if (exists) {
      alert(`Já existe uma pasta para ${MONTHS_PT[newFolderMonth - 1]} / ${newFolderYear}!`);
      return;
    }

    try {
      const docRef = await addDoc(collection(db, "pastas"), {
        condominiumId: selectedCondominiumId,
        year: newFolderYear,
        month: newFolderMonth,
        createdAt: new Date().toISOString(),
      });
      await updateDoc(doc(db, "pastas", docRef.id), { id: docRef.id });

      onAddAuditLog(
        "Criação de Pasta",
        `Criou pasta mensal: ${MONTHS_PT[newFolderMonth - 1]}/${newFolderYear} para o condomínio ${condominiumName}`
      );

      setSelectedFolderId(docRef.id);
      setIsCreatingFolder(false);
      onRefresh();
    } catch (error) {
      console.error(error);
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
        const folderLabel = folderObj ? `${MONTHS_PT[folderObj.month - 1]}/${folderObj.year}` : selectedFolderId;
        
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
      alert("Falha no download do PDF. Exibindo alternativa de texto.");
    }
  };

  // Delete File
  const handleDeleteFile = async (id: string, name: string) => {
    if (!confirm(`Tem certeza de que deseja excluir o arquivo "${name}"?`)) return;
    try {
      await deleteDoc(doc(db, "arquivos", id));
      onAddAuditLog(
        "Exclusão de Arquivo",
        `Excluiu o arquivo: ${name} do condomínio ${condominiumName}`
      );
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Folder
  const handleDeleteFolder = async (folderId: string, label: string) => {
    if (!confirm(`Tem certeza de que deseja excluir a pasta "${label}" e TODOS os seus arquivos?`)) return;
    try {
      // Delete associated files first
      const associatedFiles = files.filter(f => f.folderId === folderId);
      for (const file of associatedFiles) {
        await deleteDoc(doc(db, "arquivos", file.id));
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
    }
  };

  const selectedFolder = folders.find((f) => f.id === selectedFolderId);

  return (
    <div id="foldersTabRoot" className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {/* Column 1: Folder list */}
      <div className="md:col-span-1 bg-white p-6 border border-[#111111] flex flex-col h-[600px] shadow-none">
        <div className="flex items-center justify-between pb-4 border-b border-[#111111] mb-6">
          <h2 className="font-serif italic text-2xl text-[#111111] flex items-center gap-2">
            <FolderKanban className="w-5 h-5" /> Pastas Mensais
          </h2>
          {canModify && (
            <button
              onClick={() => setIsCreatingFolder(!isCreatingFolder)}
              className="p-1 border border-[#111111] hover:bg-[#F4F2EE] transition-colors cursor-pointer"
              title="Nova Pasta"
            >
              <Plus className="w-5 h-5 text-[#111111]" />
            </button>
          )}
        </div>

        {isCreatingFolder && (
          <form
            onSubmit={handleCreateFolder}
            className="mb-6 p-4 border border-[#111111] bg-[#F4F2EE]/30 space-y-4"
          >
            <h4 className="font-bold text-[10px] uppercase tracking-widest text-[#111111]">Nova Pasta Mensal</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[9px] font-bold text-[#111111] uppercase tracking-widest mb-1.5">Ano</label>
                <input
                  type="number"
                  min={2020}
                  max={2100}
                  value={newFolderYear}
                  onChange={(e) => setNewFolderYear(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-[#111111] rounded-none text-sm bg-white outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-[#111111] uppercase tracking-widest mb-1.5">Mês</label>
                <select
                  value={newFolderMonth}
                  onChange={(e) => setNewFolderMonth(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-[#111111] rounded-none text-sm bg-white outline-none"
                  required
                >
                  {MONTHS_PT.map((m, idx) => (
                    <option key={idx} value={idx + 1}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
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
              Nenhuma pasta mensal criada.
            </div>
          ) : (
            filteredFolders.map((folder, index) => {
              const label = `${MONTHS_PT[folder.month - 1]} / ${folder.year}`;
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
                  <span className="font-serif italic text-sm text-center text-[#111111]/40 group-hover:text-[#111111]">
                    {formattedIndex}
                  </span>
                  <div className="flex items-center justify-between pr-3">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider">{label}</div>
                      <div className="text-[10px] text-gray-500 font-serif italic">{fileCount} arquivos anexados</div>
                    </div>
                    {canModify && (
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
          <>
            <div className="flex items-center justify-between pb-4 border-b border-[#111111]">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-40">Documentação Selecionada</p>
                <h3 className="text-3xl font-serif italic tracking-tight text-[#111111]">
                  {MONTHS_PT[selectedFolder.month - 1]} / {selectedFolder.year}
                </h3>
              </div>
              <span className="border border-[#111111] bg-[#F4F2EE] text-[#111111] text-[10px] uppercase font-bold tracking-widest px-3 py-1.5">
                {filteredFiles.length} ARQUIVOS PDF
              </span>
            </div>

            {/* Upload Zone (Administradores only) */}
            {canModify && (
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
                  Esta pasta mensal está vazia. Nenhum arquivo PDF anexado.
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

                      <div className="mt-4 pt-4 border-t border-[#111111]/10 flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleDownloadFile(file)}
                          className="px-4 py-2 border border-[#111111] hover:bg-[#F4F2EE] text-[10px] uppercase font-bold tracking-widest transition-all cursor-pointer flex items-center gap-1"
                        >
                          <Download className="w-3.5 h-3.5" /> Baixar Relatório
                        </button>
                        {canModify && (
                          <button
                            onClick={() => handleDeleteFile(file.id, file.name)}
                            className="px-4 py-2 border border-red-700 text-red-700 hover:bg-red-50 text-[10px] uppercase font-bold tracking-widest transition-all cursor-pointer flex items-center gap-1"
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
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-400 p-8">
            <div className="p-4 bg-[#F4F2EE] border border-[#111111] mb-4 text-[#111111]">
              <FileText className="w-12 h-12" />
            </div>
            <h3 className="text-xl font-serif italic text-[#111111]">Selecione uma pasta mensal</h3>
            <p className="text-xs max-w-xs mt-2 leading-relaxed">
              Escolha uma pasta na lista à esquerda para visualizar, enviar ou fazer o download dos arquivos de prestação de contas.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
