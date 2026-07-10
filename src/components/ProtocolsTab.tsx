import React, { useState } from "react";
import { collection, addDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { User, Protocol, Message } from "../types";
import { Send, FileCheck, HelpCircle, MessageSquarePlus, Clock, ShieldAlert, Paperclip, AlertOctagon, CheckCircle } from "lucide-react";

interface ProtocolsTabProps {
  currentUser: User;
  selectedCondominiumId: string;
  protocols: Protocol[];
  messages: Message[];
  onRefresh: () => void;
  onAddAuditLog: (action: string, details: string) => void;
  condominiumName: string;
}

export default function ProtocolsTab({
  currentUser,
  selectedCondominiumId,
  protocols,
  messages,
  onRefresh,
  onAddAuditLog,
  condominiumName,
}: ProtocolsTabProps) {
  const [selectedProtocolId, setSelectedProtocolId] = useState<string | null>(null);
  
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
        alert("O tamanho máximo para anexo é de 2MB.");
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
  const handleCloseProtocol = async () => {
    if (!selectedProtocolId) return;
    if (!confirm("Deseja realmente encerrar esta demanda? Não será mais possível enviar novas mensagens.")) return;

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

  return (
    <div id="protocolsTabRoot" className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {/* Column 1: Protocols List */}
      <div className="md:col-span-1 bg-white p-6 border border-[#111111] flex flex-col h-[600px] shadow-none">
        <div className="flex items-center justify-between pb-4 border-b border-[#111111] mb-6">
          <h2 className="font-serif italic text-2xl text-[#111111] flex items-center gap-2">
            <Clock className="w-5 h-5" /> Atendimentos
          </h2>
          <button
            onClick={() => setIsCreatingProtocol(!isCreatingProtocol)}
            className="p-1 border border-[#111111] hover:bg-[#F4F2EE] transition-colors cursor-pointer"
            title="Abrir Demanda"
          >
            <MessageSquarePlus className="w-5 h-5 text-[#111111]" />
          </button>
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
                {selectedProto.status !== "encerrado" && (
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
  );
}
