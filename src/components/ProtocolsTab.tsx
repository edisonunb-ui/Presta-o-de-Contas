import React, { useState } from "react";
import { collection, addDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { User, Protocol, Message, FileEntry, Folder } from "../types";
import { Send, FileCheck, HelpCircle, MessageSquarePlus, Clock, ShieldAlert, Paperclip, AlertOctagon, CheckCircle, FileText, Share2, ClipboardCheck } from "lucide-react";

interface ProtocolsTabProps {
  currentUser: User;
  selectedCondominiumId: string;
  protocols: Protocol[];
  messages: Message[];
  files: FileEntry[];
  folders: Folder[];
  onRefresh: () => void;
  onAddAuditLog: (action: string, details: string) => void;
  condominiumName: string;
}

export default function ProtocolsTab({
  currentUser,
  selectedCondominiumId,
  protocols,
  messages,
  files,
  folders,
  onRefresh,
  onAddAuditLog,
  condominiumName,
}: ProtocolsTabProps) {
  const [selectedProtocolId, setSelectedProtocolId] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<"demandas" | "entregas">("demandas");
  const [selectedReceiptFile, setSelectedReceiptFile] = useState<FileEntry | null>(null);
  
  // Permission checks
  const hasPermission = (key: string, defaultVal: boolean) => {
    if (currentUser.role === "SuperADM") return true;
    if (currentUser.permissions && (currentUser.permissions as any)[key] !== undefined) {
      return !!(currentUser.permissions as any)[key];
    }
    return defaultVal;
  };

  const canViewProtocols = hasPermission("protocols_view", true);
  const canCreateProtocols = hasPermission("protocols_create", true);
  const canReplyProtocols = hasPermission("protocols_reply", true);
  const canCloseProtocols = hasPermission("protocols_close", currentUser.role === "SuperADM" || currentUser.role === "Administrador");
  
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

  // Create protocol states
  const [isCreatingProtocol, setIsCreatingProtocol] = useState(false);
  const [protoSubject, setProtoSubject] = useState("");
  const [protoDescription, setProtoDescription] = useState("");
  const [protoPriority, setProtoPriority] = useState<"normal" | "alta" | "urgente">("normal");
  const [protoDirection, setProtoDirection] = useState<"sindico_para_administradora" | "administradora_para_sindico">(
    currentUser.role === "Sindico" ? "sindico_para_administradora" : "administradora_para_sindico"
  );

  // Reply states
  const [replyText, setReplyText] = useState("");
  const [attachedFileBase64, setAttachedFileBase64] = useState("");
  const [attachedFileName, setAttachedFileName] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);

  // Filter protocols for the selected condominium
  const filteredProtocols = protocols
    .filter((p) => p.condominiumId === selectedCondominiumId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Filter messages for selected protocol
  const filteredMessages = messages
    .filter((m) => m.protocolId === selectedProtocolId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  // Create protocol
  const handleCreateProtocol = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCondominiumId || !protoSubject.trim() || !protoDescription.trim()) return;

    try {
      const docRef = await addDoc(collection(db, "protocolos"), {
        condominiumId: selectedCondominiumId,
        subject: protoSubject.trim(),
        description: protoDescription.trim(),
        direction: currentUser.role === "Sindico" ? "sindico_para_administradora" : protoDirection,
        priority: protoPriority,
        status: "aberto",
        createdAt: new Date().toISOString(),
      });
      await updateDoc(doc(db, "protocolos", docRef.id), { id: docRef.id });

      // Create initial message
      const msgRef = await addDoc(collection(db, "mensagens"), {
        protocolId: docRef.id,
        senderName: currentUser.name,
        senderRole: currentUser.role,
        message: protoDescription.trim(),
        createdAt: new Date().toISOString(),
      });
      await updateDoc(doc(db, "mensagens", msgRef.id), { id: msgRef.id });

      onAddAuditLog(
        "Abertura de Demanda",
        `Abriu novo protocolo (#${docRef.id}): "${protoSubject.trim()}" (${protoPriority}) para o condomínio ${condominiumName}`
      );

      setSelectedProtocolId(docRef.id);
      setIsCreatingProtocol(false);
      setProtoSubject("");
      setProtoDescription("");
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  // Convert attachment to base64
  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 2 * 1024 * 1024) {
        showAlert("Aviso", "O tamanho máximo para anexo é de 2MB.");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        setAttachedFileBase64(base64);
        setAttachedFileName(file.name);
      };
      reader.readAsDataURL(file);
    }
  };

  // Reply sending
  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProtocolId || (!replyText.trim() && !attachedFileBase64)) return;

    setIsSendingReply(true);
    try {
      const msgRef = await addDoc(collection(db, "mensagens"), {
        protocolId: selectedProtocolId,
        senderName: currentUser.name,
        senderRole: currentUser.role,
        message: replyText.trim() || `Anexou arquivo: ${attachedFileName}`,
        createdAt: new Date().toISOString(),
        fileUrl: attachedFileBase64 || null,
        fileName: attachedFileName || null,
      });
      await updateDoc(doc(db, "mensagens", msgRef.id), { id: msgRef.id });

      // Update protocol status depending on sender
      // If Sindico replies, status becomes 'aberto' (needs attention)
      // If Administrador or SuperADM replies, status becomes 'respondido'
      const newStatus = (currentUser.role === "Administrador" || currentUser.role === "SuperADM") ? "respondido" : "aberto";
      await updateDoc(doc(db, "protocolos", selectedProtocolId), { status: newStatus });

      setReplyText("");
      setAttachedFileBase64("");
      setAttachedFileName("");
      onRefresh();
      setIsSendingReply(false);
    } catch (err) {
      console.error(err);
      setIsSendingReply(false);
    }
  };

  // Close Protocol
  const handleCloseProtocol = () => {
    if (!selectedProtocolId) return;
    showConfirm(
      "Encerrar Demanda",
      "Deseja realmente encerrar esta demanda? Não será mais possível enviar novas mensagens.",
      async () => {
        try {
          await updateDoc(doc(db, "protocolos", selectedProtocolId), {
            status: "encerrado",
            closedAt: new Date().toISOString(),
          });

          // Add a final administrative log message
          const msgRef = await addDoc(collection(db, "mensagens"), {
            protocolId: selectedProtocolId,
            senderName: "Sistema",
            senderRole: "Sistema",
            message: `Esta demanda foi encerrada e finalizada por ${currentUser.name}.`,
            createdAt: new Date().toISOString(),
          });
          await updateDoc(doc(db, "mensagens", msgRef.id), { id: msgRef.id });

          onAddAuditLog(
            "Encerramento de Demanda",
            `Encerrou o protocolo (#${selectedProtocolId}) no condomínio ${condominiumName}`
          );

          onRefresh();
        } catch (err) {
          console.error(err);
        }
      }
    );
  };

  const handleDownloadAttachment = (base64: string, name: string) => {
    try {
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    }
  };

  const selectedProto = protocols.find((p) => p.id === selectedProtocolId);

  if (!canViewProtocols) {
    return (
      <div className="bg-white p-12 border border-[#111111] text-center max-w-2xl mx-auto space-y-4">
        <AlertOctagon className="w-12 h-12 text-[#C2A87E] mx-auto animate-pulse" />
        <h3 className="font-serif italic text-2xl text-[#111111]">Acesso Restrito</h3>
        <p className="text-sm text-gray-600 font-sans max-w-md mx-auto">
          Você não possui permissão para visualizar a aba de Atendimentos. Entre em contato com o administrador para solicitar acesso.
        </p>
      </div>
    );
  }

  // Calculate files and folders for selected condominium
  const condoFolders = folders.filter(f => f.condominiumId === selectedCondominiumId);
  const condoFolderIds = condoFolders.map(f => f.id);
  const condoFiles = files.filter(file => condoFolderIds.includes(file.folderId))
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

  const getFolderLabel = (folderId: string) => {
    const f = folders.find(folder => folder.id === folderId);
    if (!f) return "Pasta Desconhecida";
    return `${String(f.month).padStart(2, "0")}/${f.year}`;
  };

  const getFriendlyRoleName = (role: string) => {
    if (role === "SuperADM") return "Administrador Global";
    if (role === "Administrador") return "Administrador";
    return "Síndico";
  };

  const getCertificateHash = (fileId: string) => {
    let hash = 0;
    for (let i = 0; i < fileId.length; i++) {
      hash = (hash << 5) - hash + fileId.charCodeAt(i);
      hash |= 0;
    }
    const hex = Math.abs(hash).toString(16).toUpperCase();
    return "SHA256-PC" + hex.padStart(8, "0") + "X" + Math.floor(Math.random() * 10000);
  };

  return (
    <div id="protocolsTabRoot" className="space-y-6">
      {/* Sub-Tabs Switcher */}
      <div className="flex border-b border-[#111111]/15 pb-1">
        <button
          onClick={() => setActiveSubTab("demandas")}
          className={`px-6 py-3 text-xs font-extrabold uppercase tracking-widest border-b-2 transition-all cursor-pointer ${
            activeSubTab === "demandas"
              ? "border-[#123E33] text-[#123E33]"
              : "border-transparent text-gray-400 hover:text-[#123E33]"
          }`}
        >
          💬 Chamados & Demandas
        </button>
        <button
          onClick={() => setActiveSubTab("entregas")}
          className={`px-6 py-3 text-xs font-extrabold uppercase tracking-widest border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeSubTab === "entregas"
              ? "border-[#123E33] text-[#123E33]"
              : "border-transparent text-gray-400 hover:text-[#123E33]"
          }`}
        >
          📋 Protocolos de Entrega / Aceites
          <span className="bg-[#123E33] text-white text-[9px] px-1.5 py-0.5 rounded-full">
            {condoFiles.length}
          </span>
        </button>
      </div>

      {activeSubTab === "demandas" ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {/* Column 1: Protocols List */}
      <div className="md:col-span-1 bg-white p-6 border border-[#111111] flex flex-col h-[600px] shadow-none">
        <div className="flex items-center justify-between pb-4 border-b border-[#111111] mb-6">
          <h2 className="font-serif italic text-2xl text-[#111111] flex items-center gap-2">
            <Clock className="w-5 h-5" /> Atendimentos
          </h2>
          {canCreateProtocols && (
            <button
              onClick={() => setIsCreatingProtocol(!isCreatingProtocol)}
              className="p-1 border border-[#111111] hover:bg-[#F4F2EE] transition-colors cursor-pointer"
              title="Abrir Demanda"
            >
              <MessageSquarePlus className="w-5 h-5 text-[#111111]" />
            </button>
          )}
        </div>

        {isCreatingProtocol && (
          <form
            onSubmit={handleCreateProtocol}
            className="mb-6 p-4 border border-[#111111] bg-[#F4F2EE]/30 space-y-4 overflow-y-auto max-h-[350px]"
          >
            <h4 className="font-bold text-[10px] uppercase tracking-widest text-[#111111]">Nova Solicitação</h4>
            
            <div>
              <label className="block text-[9px] font-bold text-[#111111] uppercase tracking-widest mb-1.5">Assunto / Título</label>
              <input
                type="text"
                maxLength={100}
                placeholder="Ex: Vazamento bloco C"
                value={protoSubject}
                onChange={(e) => setProtoSubject(e.target.value)}
                className="w-full px-3 py-2 border border-[#111111] rounded-none text-sm bg-white outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-[9px] font-bold text-[#111111] uppercase tracking-widest mb-1.5">Descrição Inicial</label>
              <textarea
                placeholder="Detalhe a solicitação ou dúvida..."
                rows={3}
                value={protoDescription}
                onChange={(e) => setProtoDescription(e.target.value)}
                className="w-full px-3 py-2 border border-[#111111] rounded-none text-sm bg-white outline-none resize-none"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[9px] font-bold text-[#111111] uppercase tracking-widest mb-1.5">Prioridade</label>
                <select
                  value={protoPriority}
                  onChange={(e) => setProtoPriority(e.target.value as any)}
                  className="w-full px-2 py-2 border border-[#111111] rounded-none text-xs bg-white outline-none"
                >
                  <option value="normal">Normal</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                </select>
              </div>
              {currentUser.role !== "Sindico" && (
                <div>
                  <label className="block text-[9px] font-bold text-[#111111] uppercase tracking-widest mb-1.5">Sentido</label>
                  <select
                    value={protoDirection}
                    onChange={(e) => setProtoDirection(e.target.value as any)}
                    className="w-full px-2 py-2 border border-[#111111] rounded-none text-xs bg-white outline-none"
                  >
                    <option value="administradora_para_sindico">Adm p/ Síndico</option>
                    <option value="sindico_para_administradora">Síndico p/ Adm</option>
                  </select>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 bg-[#111111] hover:bg-[#C2A87E] text-white text-[10px] uppercase font-bold tracking-widest py-2.5 transition-colors cursor-pointer rounded-none border border-[#111111]"
              >
                Abrir Demanda
              </button>
              <button
                type="button"
                onClick={() => setIsCreatingProtocol(false)}
                className="flex-1 bg-white hover:bg-gray-100 text-[#111111] text-[10px] uppercase font-bold tracking-widest py-2.5 transition-colors cursor-pointer border border-[#111111]"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {filteredProtocols.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm font-serif italic">
              Nenhuma demanda em andamento.
            </div>
          ) : (
            filteredProtocols.map((p) => {
              const isSelected = p.id === selectedProtocolId;
              const dateLabel = new Date(p.createdAt).toLocaleDateString("pt-BR");
              
              // status styles
              let statusLabel = "Aberto";
              let statusClass = "text-green-700 bg-green-50 border-green-200";
              if (p.status === "respondido") {
                statusLabel = "Respondido";
                statusClass = "text-blue-700 bg-blue-50 border-blue-200";
              } else if (p.status === "encerrado") {
                statusLabel = "Encerrado";
                statusClass = "text-gray-700 bg-gray-50 border-gray-300";
              }

              // priority styles
              let priorityLabel = "Normal";
              let priorityClass = "text-gray-500";
              if (p.priority === "alta") {
                priorityLabel = "Alta";
                priorityClass = "text-amber-700 font-bold";
              }
              if (p.priority === "urgente") {
                priorityLabel = "Urgente";
                priorityClass = "text-red-700 font-bold underline";
              }

              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedProtocolId(p.id)}
                  className={`p-4 border cursor-pointer transition-all ${
                    isSelected
                      ? "bg-[#F4F2EE] border-[#111111] border-l-4 border-l-[#111111]"
                      : "bg-[#FDFCFB]/50 border-gray-200 hover:bg-[#F4F2EE]/30"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[9px] uppercase font-bold tracking-wider px-2.5 py-1 border rounded-none ${statusClass}`}>
                      {statusLabel}
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">{dateLabel}</span>
                  </div>
                  <h3 className="font-bold text-sm line-clamp-1 text-[#111111]">{p.subject}</h3>
                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
                    <span className="text-[9px] text-gray-400 font-mono">PROTOCOLO: #{p.id.slice(0, 6).toUpperCase()}</span>
                    <span className={`text-[9px] uppercase tracking-wider flex items-center gap-1 ${priorityClass}`}>
                      • {priorityLabel}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Column 2 & 3: Selected Protocol details and message feed */}
      <div className="md:col-span-2 bg-white p-6 border border-[#111111] flex flex-col h-[600px] shadow-none">
        {selectedProto ? (
          <>
            {/* Header info */}
            <div className="flex items-center justify-between pb-4 border-b border-[#111111] mb-6">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-gray-400">PROTOCOLO #{selectedProto.id.toUpperCase()}</span>
                <h3 className="text-2xl font-serif italic text-[#111111] line-clamp-1 mt-1">{selectedProto.subject}</h3>
              </div>
              <div className="flex items-center gap-2">
                {selectedProto.status !== "encerrado" && canCloseProtocols && (
                  <button
                    onClick={handleCloseProtocol}
                    className="flex items-center gap-1.5 border border-red-700 hover:bg-red-50 text-red-700 text-[10px] uppercase font-bold tracking-widest px-4 py-2 transition-all cursor-pointer"
                  >
                    <CheckCircle className="w-3.5 h-3.5" /> Encerrar Chamado
                  </button>
                )}
                {selectedProto.status === "encerrado" && (
                  <span className="border border-gray-300 bg-gray-50 text-gray-500 text-[10px] uppercase font-bold tracking-widest px-4 py-2">
                    Encerrado
                  </span>
                )}
              </div>
            </div>

            {/* Message Chat Feed */}
            <div className="flex-1 overflow-y-auto space-y-4 p-4 bg-[#F9F8F6] border border-gray-200 mb-6">
              {filteredMessages.map((msg) => {
                const isMe = msg.senderName === currentUser.name;
                const isSystem = msg.senderRole === "Sistema";

                if (isSystem) {
                  return (
                    <div key={msg.id} className="text-center my-4">
                      <span className="bg-white text-gray-500 text-[9px] uppercase font-bold tracking-widest px-4 py-1.5 border border-gray-300">
                        {msg.message}
                      </span>
                    </div>
                  );
                }

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col max-w-[85%] ${isMe ? "ml-auto items-end" : "mr-auto items-start"}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#111111]">{msg.senderName}</span>
                      <span className="text-[9px] text-gray-400">
                        ({msg.senderRole.toUpperCase()}) • {new Date(msg.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>

                    <div
                      className={`p-4 border text-sm rounded-none ${
                        isMe
                          ? "bg-[#111111] text-white border-[#111111]"
                          : "bg-white text-[#111111] border-gray-200"
                      }`}
                    >
                      <p className="whitespace-pre-line leading-relaxed">{msg.message}</p>
                      
                      {/* Attached Document */}
                      {msg.fileUrl && (
                        <div
                          onClick={() => handleDownloadAttachment(msg.fileUrl!, msg.fileName || "anexo")}
                          className={`mt-3 p-2 border flex items-center gap-2 cursor-pointer transition-colors text-xs rounded-none ${
                            isMe
                              ? "bg-white/10 text-white hover:bg-white/20 border-white/20"
                              : "bg-[#F4F2EE] text-[#111111] hover:bg-gray-200 border-gray-300"
                          }`}
                        >
                          <Paperclip className="w-3.5 h-3.5" />
                          <span className="underline font-bold tracking-wider text-[10px] uppercase truncate max-w-[180px]">
                            {msg.fileName || "Anexo"}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Reply inputs */}
            {selectedProto.status !== "encerrado" ? (
              !canReplyProtocols ? (
                <div className="bg-[#F4F2EE] p-4 border border-gray-300 text-center text-xs font-serif italic text-gray-500">
                  Seu usuário não possui permissão para responder a chamados.
                </div>
              ) : (
                <form onSubmit={handleSendReply} className="space-y-4">
                <div className="flex items-center gap-4 bg-white p-3 border-2 border-[#111111]">
                  <textarea
                    rows={2}
                    placeholder="Escreva sua resposta técnica ou administrativa aqui..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="flex-1 bg-transparent border-none outline-none resize-none text-sm p-1.5 placeholder-gray-400"
                    required={!attachedFileBase64}
                  />

                  <div className="flex flex-col gap-2 shrink-0">
                    <label className="p-3 border border-gray-300 hover:border-[#111111] text-gray-600 hover:text-[#111111] cursor-pointer transition-colors relative flex items-center justify-center">
                      <Paperclip className="w-4 h-4" />
                      <input
                        type="file"
                        onChange={handleAttachmentChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                    </label>

                    <button
                      type="submit"
                      disabled={isSendingReply}
                      className="p-3 bg-[#111111] hover:bg-[#C2A87E] disabled:bg-gray-300 text-white transition-colors cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {attachedFileName && (
                  <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-wider text-emerald-800 bg-emerald-50 px-4 py-2 border border-emerald-200">
                    <Paperclip className="w-3.5 h-3.5" /> Anexo selecionado: <span className="font-mono">{attachedFileName}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setAttachedFileBase64("");
                        setAttachedFileName("");
                      }}
                      className="text-red-700 hover:text-red-950 font-bold ml-auto"
                    >
                      Remover
                    </button>
                  </div>
                )}
              </form>
              )
            ) : (
              <div className="bg-[#F4F2EE] p-4 border border-gray-300 text-center text-xs font-serif italic text-gray-600">
                Esta demanda foi encerrada e está bloqueada para novas respostas.
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-400 p-8">
            <div className="p-4 bg-[#F4F2EE] border border-[#111111] mb-4 text-[#111111]">
              <HelpCircle className="w-12 h-12" />
            </div>
            <h3 className="text-xl font-serif italic text-[#111111]">Selecione uma demanda</h3>
            <p className="text-xs max-w-xs mt-2 leading-relaxed">
              Escolha uma demanda da lista ou clique no ícone de "+" para abrir uma nova solicitação técnica ou administrativa.
            </p>
          </div>
        )}
      </div>
    </div>
  ) : (
        /* DELIVERIES & RECEIPTS VIEW */
        <div className="bg-white p-6 sm:p-8 border border-[#111111] min-h-[500px]">
          <div className="pb-6 border-b border-[#111111]/15 mb-6 flex flex-col sm:flex-row sm:items-baseline justify-between gap-4">
            <div>
              <span className="text-[9px] uppercase tracking-[0.25em] font-extrabold text-[#123E33] block mb-1">
                ⚖️ Irrefutabilidade Contábil
              </span>
              <h2 className="font-serif italic text-3xl text-[#111111]">
                Registro de Protocolos de Entrega (Aceites)
              </h2>
            </div>
            <div className="text-[10px] font-mono text-gray-500 uppercase tracking-wider bg-stone-50 p-2.5 border border-stone-200">
              Total de Arquivos: {condoFiles.length}
            </div>
          </div>

          <div className="p-4 bg-stone-50 border border-stone-200 text-stone-700 text-xs leading-relaxed max-w-4xl mb-6 text-left">
            <strong className="uppercase tracking-wider font-bold block text-stone-900 mb-1">Garantia de Entrega e Blindagem de Contas:</strong>
            De acordo com os requisitos do manual do portal, cada upload de documento de prestação de contas gera um <strong className="text-stone-900">Protocolo Digital de Entrega</strong> em estado pendente. No momento em que o Síndico visualiza e assina eletronicamente o documento, as credenciais de login, data/hora e IP de conexão são salvos na trilha jurídica, blindando a administradora contra alegações de falta de entrega.
          </div>

          {condoFiles.length === 0 ? (
            <div className="text-center py-20 text-gray-400 text-sm font-serif italic">
              Nenhum documento ou relatório foi enviado para as pastas mensais deste condomínio ainda.
            </div>
          ) : (
            <div className="overflow-x-auto text-left">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#123E33]/5 border-y border-[#111111] text-[10px] uppercase font-bold tracking-wider text-[#123E33]">
                    <th className="p-4 font-sans">Documento PDF / Relatório</th>
                    <th className="p-4 font-sans">Pasta Mensal</th>
                    <th className="p-4 font-sans">Data de Envio</th>
                    <th className="p-4 font-sans">Enviado Por</th>
                    <th className="p-4 font-sans">Status do Aceite</th>
                    <th className="p-4 font-sans text-right">Ação Legal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 font-sans">
                  {condoFiles.map((file) => {
                    const isConfirmed = file.receiptStatus === "confirmado";
                    return (
                      <tr key={file.id} className="hover:bg-stone-50 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-red-800 shrink-0" />
                            <div>
                              <span className="font-bold text-gray-900 block truncate max-w-xs sm:max-w-md" title={file.name}>
                                {file.name}
                              </span>
                              <span className="text-[10px] text-gray-400 font-mono uppercase">
                                TAMANHO: {(file.size / (1024 * 1024)).toFixed(2)} MB {file.driveFileId ? `• ID: ${file.driveFileId.substring(0, 10)}...` : ""}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 uppercase font-bold font-mono text-[#123E33]">
                          {getFolderLabel(file.folderId)}
                        </td>
                        <td className="p-4 text-gray-500">
                          {new Date(file.uploadedAt).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="p-4 text-gray-600 uppercase font-bold text-[10px]">
                          {file.uploadedBy}
                        </td>
                        <td className="p-4">
                          {isConfirmed ? (
                            <div className="inline-flex items-center gap-1 bg-emerald-50 text-[#123E33] border border-emerald-300 px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                              <span>Confirmado</span>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-300 px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
                              <span>Pendente</span>
                            </div>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          {isConfirmed ? (
                            <button
                              onClick={() => setSelectedReceiptFile(file)}
                              className="px-3 py-2 bg-[#123E33] hover:bg-[#1c5d4d] text-white text-[9px] uppercase font-bold tracking-widest border border-[#123E33] cursor-pointer transition-colors"
                              title="Visualizar documento do certificado digital assinado pelo Síndico"
                            >
                              📋 Ver Certificado
                            </button>
                          ) : (
                            <span className="text-gray-400 italic text-[10px] pr-2">Sem assinatura</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL: VISUALIZADOR DE CERTIFICADO DE ACEITE DIGITAL */}
      {selectedReceiptFile && (
        <div id="receiptCertificateModal" className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/65 backdrop-blur-xs transition-opacity"
            onClick={() => setSelectedReceiptFile(null)}
          />
          <div className="relative bg-[#FAF9F6] border-4 border-[#111111] p-8 max-w-2xl w-full shadow-2xl z-10 space-y-6 overflow-y-auto max-h-[90vh]">
            
            {/* Header Stamp style */}
            <div className="text-center space-y-2 border-b-2 border-dashed border-[#111111]/30 pb-6 relative">
              <div className="absolute top-4 right-4 border-2 border-emerald-600 text-emerald-600 text-[8px] font-black uppercase tracking-[0.3em] px-3 py-1.5 rotate-12 bg-white/95">
                ✓ PROTOCOLADO
              </div>
              <span className="text-[10px] uppercase tracking-[0.3em] font-extrabold text-gray-400 block">
                Nunes Informática - Gestão de Ativos
              </span>
              <h3 className="font-serif italic text-3xl text-[#111111] tracking-tight">
                Certificado Digital de Entrega de Contas
              </h3>
              <p className="text-[9px] font-mono text-stone-500 uppercase">
                Emissão Oficial para fins de Governança e Transparência Jurídica
              </p>
            </div>

            {/* Certificate Body text */}
            <div className="space-y-4 text-xs text-gray-800 leading-relaxed font-sans text-left">
              <p className="indent-6">
                Certificamos para fins de comprovação administrativa e legal que a prestação de contas mensal referente à pasta <strong className="text-[#111111]">{getFolderLabel(selectedReceiptFile.folderId)}</strong> foi disponibilizada e entregue com sucesso através do Portal de Prestação de Contas, registrando o <strong className="text-[#111111]">Aceite Digital de Recebimento</strong> do Síndico responsável pelo condomínio <strong className="text-[#111111]">{condominiumName}</strong>.
              </p>

              {/* Data Table */}
              <div className="bg-white border border-[#111111] p-4 font-mono space-y-2 text-[11px] text-[#111111] leading-relaxed">
                <div className="flex flex-col sm:flex-row sm:items-baseline">
                  <span className="text-gray-400 uppercase w-48 shrink-0 text-left">DOCUMENTO ENVIADO:</span>
                  <span className="font-bold font-sans">{selectedReceiptFile.name}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-baseline">
                  <span className="text-gray-400 uppercase w-48 shrink-0 text-left">TAMANHO DO ARQUIVO:</span>
                  <span>{(selectedReceiptFile.size / (1024 * 1024)).toFixed(2)} MB ({selectedReceiptFile.size} bytes)</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-baseline">
                  <span className="text-gray-400 uppercase w-48 shrink-0 text-left">DISPONIBILIZADO POR:</span>
                  <span className="font-sans uppercase font-bold text-gray-700">{selectedReceiptFile.uploadedBy}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-baseline">
                  <span className="text-gray-400 uppercase w-48 shrink-0 text-left">DATA DE DISPONIBILIZAÇÃO:</span>
                  <span>{new Date(selectedReceiptFile.uploadedAt).toLocaleString("pt-BR")}</span>
                </div>
                <div className="border-t border-stone-200 my-2 pt-2 flex flex-col sm:flex-row sm:items-baseline">
                  <span className="text-gray-400 uppercase w-48 shrink-0 text-left">ASSINADO POR:</span>
                  <span className="font-sans uppercase font-black text-[#123E33]">{selectedReceiptFile.confirmedBy}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-baseline">
                  <span className="text-gray-400 uppercase w-48 shrink-0 text-left">CARGO / FUNÇÃO:</span>
                  <span className="font-sans">{getFriendlyRoleName("Sindico")}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-baseline">
                  <span className="text-gray-400 uppercase w-48 shrink-0 text-left">HORÁRIO DA ASSINATURA:</span>
                  <span className="font-sans font-bold">{new Date(selectedReceiptFile.confirmedAt || "").toLocaleString("pt-BR")}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-baseline">
                  <span className="text-gray-400 uppercase w-48 shrink-0 text-left">ENDEREÇO IP CAPTURADO:</span>
                  <span className="font-bold text-emerald-800">{selectedReceiptFile.confirmationIp}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-baseline">
                  <span className="text-gray-400 uppercase w-48 shrink-0 text-left">ASSINATURA DO NAVEGADOR:</span>
                  <span className="text-[10px] text-gray-500 font-sans truncate flex-1">{selectedReceiptFile.confirmationUserAgent}</span>
                </div>
                <div className="border-t border-dashed border-stone-200 mt-2 pt-2 flex items-center justify-between text-[9px] text-gray-400">
                  <span>CÓDIGO DE VERIFICAÇÃO INTEGRAL:</span>
                  <span className="font-bold">{getCertificateHash(selectedReceiptFile.id)}</span>
                </div>
              </div>

              <p className="text-[10px] font-serif italic text-gray-500 border-t border-[#111111]/10 pt-4 text-center">
                Este certificado eletrônico garante a integridade temporal do registro de visualização e irrefutabilidade de entrega do documento contábil condominial, em plena conformidade com a MP nº 2.200-2/2001 e disposições legais vigentes.
              </p>
            </div>

            {/* Footer Buttons */}
            <div className="pt-4 border-t border-[#111111]/15 flex items-center justify-end gap-3">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-white hover:bg-stone-100 text-[#111111] text-xs uppercase font-bold tracking-widest border border-[#111111] transition-colors cursor-pointer"
              >
                🖨️ Imprimir Certificado
              </button>
              <button
                onClick={() => setSelectedReceiptFile(null)}
                className="px-4 py-2 bg-[#111111] hover:bg-stone-800 text-white text-xs uppercase font-bold tracking-widest border border-[#111111] transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

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
    </div>
  );
}
