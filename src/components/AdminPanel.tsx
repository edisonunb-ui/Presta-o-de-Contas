import React, { useState } from "react";
import { collection, addDoc, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import { User, Administradora, Condominium, UserPermissions } from "../types";
import { Building2, Shield, UserCog, Plus, Trash2, Key, Users, CheckSquare } from "lucide-react";

interface AdminPanelProps {
  currentUser: User;
  administradoras: Administradora[];
  condominios: Condominium[];
  usuarios: User[];
  onRefresh: () => void;
  onAddAuditLog: (action: string, details: string) => void;
}

export default function AdminPanel({
  currentUser,
  administradoras,
  condominios,
  usuarios,
  onRefresh,
  onAddAuditLog,
}: AdminPanelProps) {
  const [activeSubTab, setActiveSubTab] = useState<"users" | "condos" | "adms">(
    currentUser.role === "SuperADM" ? "adms" : "users"
  );

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

  // Forms states
  const [admName, setAdmName] = useState("");
  const [condoName, setCondoName] = useState("");
  const [condoAdmId, setCondoAdmId] = useState("");
  
  const [userEmail, setUserEmail] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState<"Administrador" | "Sindico">("Sindico");
  const [userAdmId, setUserAdmId] = useState("");
  const [userSelectedCondos, setUserSelectedCondos] = useState<string[]>([]);

  const [userPermissions, setUserPermissions] = useState<Required<UserPermissions>>({
    folders_view: true,
    folders_create: false,
    folders_delete: false,
    files_view: true,
    files_upload: false,
    files_delete: false,
    protocols_view: true,
    protocols_create: true,
    protocols_reply: true,
    protocols_close: false,
    register_sindicos: false,
    register_condos: false,
    view_audit_logs: false,
  });

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editRole, setEditRole] = useState<"Administrador" | "Sindico">("Sindico");
  const [editSelectedCondos, setEditSelectedCondos] = useState<string[]>([]);
  const [editPermissions, setEditPermissions] = useState<Required<UserPermissions>>({
    folders_view: true,
    folders_create: false,
    folders_delete: false,
    files_view: true,
    files_upload: false,
    files_delete: false,
    protocols_view: true,
    protocols_create: true,
    protocols_reply: true,
    protocols_close: false,
    register_sindicos: false,
    register_condos: false,
    view_audit_logs: false,
  });

  const getRoleDefaultPermissions = (role: "Administrador" | "Sindico") => {
    if (role === "Administrador") {
      return {
        folders_view: true,
        folders_create: true,
        folders_delete: false,
        files_view: true,
        files_upload: true,
        files_delete: false,
        protocols_view: true,
        protocols_create: true,
        protocols_reply: true,
        protocols_close: true,
        register_sindicos: true,
        register_condos: true,
        view_audit_logs: false,
      };
    } else {
      return {
        folders_view: true,
        folders_create: false,
        folders_delete: false,
        files_view: true,
        files_upload: false,
        files_delete: false,
        protocols_view: true,
        protocols_create: true,
        protocols_reply: true,
        protocols_close: false,
        register_sindicos: false,
        register_condos: false,
        view_audit_logs: false,
      };
    }
  };

  const handleRoleChange = (role: "Administrador" | "Sindico") => {
    setUserRole(role);
    setUserPermissions(getRoleDefaultPermissions(role));
  };

  const handleStartEditUser = (user: User) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditPassword(user.password || "");
    setEditRole(user.role as "Administrador" | "Sindico");
    setEditSelectedCondos(user.condominiumIds || []);
    
    const defaults = getRoleDefaultPermissions(user.role as "Administrador" | "Sindico");
    setEditPermissions({
      folders_view: user.permissions?.folders_view ?? defaults.folders_view,
      folders_create: user.permissions?.folders_create ?? defaults.folders_create,
      folders_delete: user.permissions?.folders_delete ?? defaults.folders_delete,
      files_view: user.permissions?.files_view ?? defaults.files_view,
      files_upload: user.permissions?.files_upload ?? defaults.files_upload,
      files_delete: user.permissions?.files_delete ?? defaults.files_delete,
      protocols_view: user.permissions?.protocols_view ?? defaults.protocols_view,
      protocols_create: user.permissions?.protocols_create ?? defaults.protocols_create,
      protocols_reply: user.permissions?.protocols_reply ?? defaults.protocols_reply,
      protocols_close: user.permissions?.protocols_close ?? defaults.protocols_close,
      register_sindicos: user.permissions?.register_sindicos ?? defaults.register_sindicos,
      register_condos: user.permissions?.register_condos ?? defaults.register_condos,
      view_audit_logs: user.permissions?.view_audit_logs ?? defaults.view_audit_logs,
    });
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!editEmail.trim() || !editName.trim()) {
      showAlert("Aviso", "Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    try {
      const emailExists = usuarios.some(
        u => u.id !== editingUser.id && u.email.toLowerCase() === editEmail.trim().toLowerCase()
      );
      if (emailExists) {
        showAlert("Erro", "Este e-mail de usuário já está em uso por outro cadastro!");
        return;
      }

      await updateDoc(doc(db, "usuarios", editingUser.id), {
        name: editName.trim(),
        email: editEmail.trim().toLowerCase(),
        password: editPassword.trim(),
        role: editRole,
        condominiumIds: editRole === "Sindico" ? editSelectedCondos : [],
        permissions: editPermissions,
      });

      onAddAuditLog(
        "Edição de Usuário",
        `Editou dados/permissões do usuário: ${editName.trim()} (${editRole}) com e-mail: ${editEmail.trim().toLowerCase()}`
      );

      showAlert("Sucesso", "Usuário atualizado com sucesso!");
      setEditingUser(null);
      onRefresh();
    } catch (error) {
      console.error(error);
      showAlert("Erro", "Erro ao atualizar usuário: " + (error instanceof Error ? error.message : String(error)));
    }
  };

  // Submitting Administradora
  const handleCreateAdm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!admName.trim()) return;
    try {
      const docRef = await addDoc(collection(db, "administradoras"), {
        name: admName.trim(),
        createdAt: new Date().toISOString(),
      });
      // update the id to match doc id
      await updateDoc(doc(db, "administradoras", docRef.id), { id: docRef.id });
      
      onAddAuditLog(
        "Criação de Administradora",
        `Criou administradora: ${admName.trim()} (${docRef.id})`
      );
      setAdmName("");
      onRefresh();
    } catch (error) {
      console.error(error);
      showAlert("Erro", "Erro ao criar administradora: " + (error instanceof Error ? error.message : String(error)));
    }
  };

  // Submitting Condominium
  const handleCreateCondo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!condoName.trim()) return;
    const finalAdmId = currentUser.role === "SuperADM" ? condoAdmId : currentUser.administradoraId;
    if (!finalAdmId) {
      showAlert("Aviso", "Por favor, selecione uma administradora para vincular o condomínio.");
      return;
    }

    try {
      const docRef = await addDoc(collection(db, "condominios"), {
        name: condoName.trim(),
        administradoraId: finalAdmId,
        createdAt: new Date().toISOString(),
      });
      await updateDoc(doc(db, "condominios", docRef.id), { id: docRef.id });

      const admObj = administradoras.find(a => a.id === finalAdmId);
      onAddAuditLog(
        "Criação de Condomínio",
        `Criou condomínio: ${condoName.trim()} vinculado à administradora: ${admObj?.name || finalAdmId}`
      );
      setCondoName("");
      onRefresh();
    } catch (error) {
      console.error(error);
      showAlert("Erro", "Erro ao criar condomínio: " + (error instanceof Error ? error.message : String(error)));
    }
  };

  // Submitting User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userEmail.trim() || !userPassword.trim() || !userName.trim()) {
      showAlert("Aviso", "Por favor, preencha todos os campos obrigatórios do usuário.");
      return;
    }
    
    const finalAdmId = currentUser.role === "SuperADM" ? userAdmId : currentUser.administradoraId;

    try {
      // Check if email already exists
      const emailExists = usuarios.some(
        u => u.email.toLowerCase() === userEmail.trim().toLowerCase()
      );
      if (emailExists) {
        showAlert("Erro", "Este e-mail de usuário já está cadastrado!");
        return;
      }

      const docRef = await addDoc(collection(db, "usuarios"), {
        email: userEmail.trim().toLowerCase(),
        password: userPassword.trim(),
        name: userName.trim(),
        role: userRole,
        administradoraId: finalAdmId || "",
        condominiumIds: userRole === "Sindico" ? userSelectedCondos : [],
        createdAt: new Date().toISOString(),
        firstAccess: true,
        permissions: userPermissions,
      });
      await updateDoc(doc(db, "usuarios", docRef.id), { id: docRef.id });

      onAddAuditLog(
        "Cadastro de Usuário",
        `Cadastrou usuário: ${userName.trim()} (${userRole}) com e-mail: ${userEmail.trim().toLowerCase()}`
      );
      
      setUserEmail("");
      setUserPassword("");
      setUserName("");
      setUserSelectedCondos([]);
      setUserPermissions(getRoleDefaultPermissions("Sindico"));
      onRefresh();
    } catch (error) {
      console.error(error);
      showAlert("Erro", "Erro ao cadastrar usuário: " + (error instanceof Error ? error.message : String(error)));
    }
  };

  // Delete handlers
  const handleDeleteAdm = (id: string, name: string) => {
    showConfirm(
      "Confirmar Exclusão",
      `Tem certeza de que deseja excluir a administradora "${name}"? Isso não excluirá os condomínios vinculados, mas eles ficarão órfãos.`,
      async () => {
        try {
          await deleteDoc(doc(db, "administradoras", id));
          onAddAuditLog("Exclusão de Administradora", `Excluiu a administradora: ${name}`);
          onRefresh();
        } catch (error) {
          console.error(error);
          showAlert("Erro", "Erro ao excluir administradora: " + (error instanceof Error ? error.message : String(error)));
        }
      }
    );
  };

  const handleDeleteCondo = (id: string, name: string) => {
    showConfirm(
      "Confirmar Exclusão",
      `Tem certeza de que deseja excluir o condomínio "${name}"?`,
      async () => {
        try {
          await deleteDoc(doc(db, "condominios", id));
          onAddAuditLog("Exclusão de Condomínio", `Excluiu o condomínio: ${name}`);
          onRefresh();
        } catch (error) {
          console.error(error);
          showAlert("Erro", "Erro ao excluir condomínio: " + (error instanceof Error ? error.message : String(error)));
        }
      }
    );
  };

  const handleDeleteUser = (id: string, name: string, email: string) => {
    if (id === currentUser.id) {
      showAlert("Aviso", "Você não pode excluir a si mesmo!");
      return;
    }
    showConfirm(
      "Confirmar Exclusão",
      `Tem certeza de que deseja excluir o usuário "${name}" (${email})?`,
      async () => {
        try {
          await deleteDoc(doc(db, "usuarios", id));
          onAddAuditLog("Exclusão de Usuário", `Excluiu o usuário: ${name} (${email})`);
          onRefresh();
        } catch (error) {
          console.error(error);
          showAlert("Erro", "Erro ao excluir usuário: " + (error instanceof Error ? error.message : String(error)));
        }
      }
    );
  };

  const toggleCondoSelection = (condoId: string) => {
    if (userSelectedCondos.includes(condoId)) {
      setUserSelectedCondos(userSelectedCondos.filter(id => id !== condoId));
    } else {
      setUserSelectedCondos([...userSelectedCondos, condoId]);
    }
  };

  // Filter condominiums visible to the user
  const visibleCondos = condominios.filter(c => {
    if (currentUser.role === "SuperADM") return true;
    return c.administradoraId === currentUser.administradoraId;
  });

  // Filter users visible
  const visibleUsers = usuarios.filter(u => {
    if (currentUser.role === "SuperADM") return true;
    // Administrador can only see users of their own administradora
    return u.administradoraId === currentUser.administradoraId && u.role !== "SuperADM";
  });

  return (
    <div id="adminPanelRoot" className="space-y-8">
      {/* Sub Tabs */}
      <div className="flex border-b border-[#111111] overflow-x-auto">
        {currentUser.role === "SuperADM" && (
          <button
            id="subTabAdms"
            onClick={() => setActiveSubTab("adms")}
            className={`py-4 px-6 font-serif text-lg border-b-4 flex items-center gap-2 transition-all cursor-pointer ${
              activeSubTab === "adms"
                ? "border-[#111111] text-[#111111] italic font-bold"
                : "border-transparent text-gray-400 hover:text-[#111111]"
            }`}
          >
            <Building2 className="w-4 h-4" /> Administradoras
          </button>
        )}
        <button
          id="subTabCondos"
          onClick={() => setActiveSubTab("condos")}
          className={`py-4 px-6 font-serif text-lg border-b-4 flex items-center gap-2 transition-all cursor-pointer ${
            activeSubTab === "condos"
              ? "border-[#111111] text-[#111111] italic font-bold"
              : "border-transparent text-gray-400 hover:text-[#111111]"
          }`}
        >
          <Shield className="w-4 h-4" /> Condomínios
        </button>
        <button
          id="subTabUsers"
          onClick={() => setActiveSubTab("users")}
          className={`py-4 px-6 font-serif text-lg border-b-4 flex items-center gap-2 transition-all cursor-pointer ${
            activeSubTab === "users"
              ? "border-[#111111] text-[#111111] italic font-bold"
              : "border-transparent text-gray-400 hover:text-[#111111]"
          }`}
        >
          <UserCog className="w-4 h-4" /> Usuários & Síndicos
        </button>
      </div>

      {/* SUB-TAB: ADMINISTRADORAS (SuperADM Only) */}
      {activeSubTab === "adms" && currentUser.role === "SuperADM" && (
        <div id="admsSection" className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 bg-white p-6 border border-[#111111] rounded-none shadow-none">
            <h3 className="font-serif italic text-xl text-[#111111] mb-6 flex items-center gap-2">
              <Plus className="w-5 h-5 text-[#111111]" /> Cadastrar Administradora
            </h3>
            <form onSubmit={handleCreateAdm} className="space-y-5">
              <div>
                <label className="block text-[9px] font-bold text-[#111111] uppercase tracking-widest mb-2">
                  Nome da Administradora
                </label>
                <input
                  type="text"
                  placeholder="Ex: Nunes Informática & Gestão"
                  value={admName}
                  onChange={(e) => setAdmName(e.target.value)}
                  className="w-full px-4 py-3 border border-[#111111] rounded-none bg-white outline-none focus:bg-[#F4F2EE] text-sm"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full bg-[#111111] hover:bg-[#C2A87E] text-white font-bold py-3.5 text-xs uppercase tracking-widest transition-colors cursor-pointer rounded-none border border-[#111111]"
              >
                Cadastrar Administradora
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 bg-white p-6 border border-[#111111] rounded-none shadow-none">
            <h3 className="font-serif italic text-xl text-[#111111] mb-6 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#111111]" /> Administradoras Cadastradas ({administradoras.length})
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b-2 border-[#111111] text-[#111111] font-bold">
                    <th className="py-3 px-4 font-serif italic">Nome</th>
                    <th className="py-3 px-4 font-serif italic">Data Cadastro</th>
                    <th className="py-3 px-4 font-serif italic text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {administradoras.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-gray-400 font-serif italic">
                        Nenhuma administradora cadastrada.
                      </td>
                    </tr>
                  ) : (
                    administradoras.map((adm) => (
                      <tr key={adm.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="py-4 px-4 font-bold text-[#111111]">{adm.name}</td>
                        <td className="py-4 px-4 text-xs text-gray-500 font-mono">
                          {new Date(adm.createdAt).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="py-4 px-4 text-right">
                          <button
                            onClick={() => handleDeleteAdm(adm.id, adm.name)}
                            className="text-red-700 hover:text-red-950 p-1.5 border border-transparent hover:border-red-200 transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB: CONDOMINIOS */}
      {activeSubTab === "condos" && (
        <div id="condosSection" className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 bg-white p-6 border border-[#111111] rounded-none shadow-none">
            <h3 className="font-serif italic text-xl text-[#111111] mb-6 flex items-center gap-2">
              <Plus className="w-5 h-5 text-[#111111]" /> Cadastrar Condomínio
            </h3>
            <form onSubmit={handleCreateCondo} className="space-y-5">
              <div>
                <label className="block text-[9px] font-bold text-[#111111] uppercase tracking-widest mb-2">
                  Nome do Condomínio
                </label>
                <input
                  type="text"
                  placeholder="Ex: Residencial Sun Flower"
                  value={condoName}
                  onChange={(e) => setCondoName(e.target.value)}
                  className="w-full px-4 py-3 border border-[#111111] rounded-none bg-white outline-none focus:bg-[#F4F2EE] text-sm"
                  required
                />
              </div>

              {currentUser.role === "SuperADM" && (
                <div>
                  <label className="block text-[9px] font-bold text-[#111111] uppercase tracking-widest mb-2">
                    Vincular à Administradora
                  </label>
                  <select
                    value={condoAdmId}
                    onChange={(e) => setCondoAdmId(e.target.value)}
                    className="w-full px-4 py-3 border border-[#111111] rounded-none bg-white outline-none focus:bg-[#F4F2EE] text-sm"
                    required
                  >
                    <option value="">Selecione...</option>
                    {administradoras.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-[#111111] hover:bg-[#C2A87E] text-white font-bold py-3.5 text-xs uppercase tracking-widest transition-colors cursor-pointer rounded-none border border-[#111111]"
              >
                Cadastrar Condomínio
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 bg-white p-6 border border-[#111111] rounded-none shadow-none">
            <h3 className="font-serif italic text-xl text-[#111111] mb-6 flex items-center gap-2">
              <Shield className="w-5 h-5 text-[#111111]" /> Condomínios Cadastrados ({visibleCondos.length})
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b-2 border-[#111111] text-[#111111] font-bold">
                    <th className="py-3 px-4 font-serif italic">Nome</th>
                    <th className="py-3 px-4 font-serif italic">Administradora</th>
                    <th className="py-3 px-4 font-serif italic">Data Cadastro</th>
                    <th className="py-3 px-4 font-serif italic text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {visibleCondos.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-gray-400 font-serif italic">
                        Nenhum condomínio cadastrado para a sua administradora.
                      </td>
                    </tr>
                  ) : (
                    visibleCondos.map((c) => {
                      const adm = administradoras.find((a) => a.id === c.administradoraId);
                      return (
                        <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-4 px-4 font-bold text-[#111111]">{c.name}</td>
                          <td className="py-4 px-4 text-xs font-bold text-gray-700 uppercase tracking-wide">
                            {adm ? adm.name : "Não vinculada"}
                          </td>
                          <td className="py-4 px-4 text-xs text-gray-500 font-mono">
                            {new Date(c.createdAt).toLocaleDateString("pt-BR")}
                          </td>
                          <td className="py-4 px-4 text-right">
                            <button
                              onClick={() => handleDeleteCondo(c.id, c.name)}
                              className="text-red-700 hover:text-red-950 p-1.5 border border-transparent hover:border-red-200 transition-colors"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB: USUARIOS */}
      {activeSubTab === "users" && (
        <div id="usersSection" className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 bg-white p-6 border border-[#111111] rounded-none shadow-none space-y-6">
            <div>
              <h3 className="font-serif italic text-xl text-[#111111] mb-6 flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#111111]" /> Pré-cadastrar Usuário
              </h3>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div>
                  <label className="block text-[9px] font-bold text-[#111111] uppercase tracking-widest mb-1.5">
                    Nome Completo
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: João da Silva"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="w-full px-3 py-2 border border-[#111111] rounded-none bg-white text-sm outline-none focus:bg-[#F4F2EE]"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-bold text-[#111111] uppercase tracking-widest mb-1.5">
                      E-mail (Acesso)
                    </label>
                    <input
                      type="email"
                      placeholder="joao@portal.local"
                      value={userEmail}
                      onChange={(e) => setUserEmail(e.target.value)}
                      className="w-full px-3 py-2 border border-[#111111] rounded-none bg-white text-sm outline-none focus:bg-[#F4F2EE]"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-[#111111] uppercase tracking-widest mb-1.5">
                      Senha Provisória
                    </label>
                    <input
                      type="text"
                      placeholder="Senha123"
                      value={userPassword}
                      onChange={(e) => setUserPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-[#111111] rounded-none bg-white text-sm outline-none focus:bg-[#F4F2EE]"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-[#111111] uppercase tracking-widest mb-1.5">
                    Tipo de Permissão
                  </label>
                  <select
                    value={userRole}
                    onChange={(e) => handleRoleChange(e.target.value as "Administrador" | "Sindico")}
                    className="w-full px-3 py-2 border border-[#111111] rounded-none bg-white text-sm outline-none focus:bg-[#F4F2EE]"
                    required
                  >
                    <option value="Sindico">Síndico (Apenas Visualização por padrão)</option>
                    {currentUser.role === "SuperADM" && (
                      <option value="Administrador">Administrador (Gestor por padrão)</option>
                    )}
                  </select>
                </div>

                {currentUser.role === "SuperADM" && (
                  <div>
                    <label className="block text-[9px] font-bold text-[#111111] uppercase tracking-widest mb-1.5">
                      Vincular à Administradora
                    </label>
                    <select
                      value={userAdmId}
                      onChange={(e) => setUserAdmId(e.target.value)}
                      className="w-full px-3 py-2 border border-[#111111] rounded-none bg-white text-sm outline-none focus:bg-[#F4F2EE]"
                      required
                    >
                      <option value="">Selecione...</option>
                      {administradoras.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {userRole === "Sindico" && (
                  <div>
                    <label className="block text-[9px] font-bold text-[#111111] uppercase tracking-widest mb-1">
                      Liberar Acesso aos Condomínios:
                    </label>
                    <p className="text-[10px] text-gray-500 mb-2 font-serif italic">
                      O síndico só visualizará as pastas dos condomínios marcados abaixo.
                    </p>
                    <div className="max-h-40 overflow-y-auto border border-[#111111] p-2 space-y-1.5 bg-[#F9F8F6]">
                      {visibleCondos.length === 0 ? (
                        <p className="text-xs text-gray-400 p-2 font-serif italic">Nenhum condomínio cadastrado.</p>
                      ) : (
                        visibleCondos.map((c) => (
                          <label
                            key={c.id}
                            className="flex items-center gap-2 p-1.5 hover:bg-white border border-transparent hover:border-gray-200 transition-colors cursor-pointer text-xs font-bold text-gray-800"
                          >
                            <input
                              type="checkbox"
                              checked={userSelectedCondos.includes(c.id)}
                              onChange={() => toggleCondoSelection(c.id)}
                              className="accent-[#111111] rounded-none h-4 w-4 border-[#111111]"
                            />
                            {c.name}
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Permissões Granulares (Super ADM) */}
                {currentUser.role === "SuperADM" && (
                  <div className="border border-[#111111] p-4 space-y-4 bg-stone-50">
                    <div>
                      <p className="text-[10px] uppercase font-bold tracking-wider text-[#111111]">
                        Configuração de Permissões Granulares
                      </p>
                      <p className="text-[9px] text-gray-500 font-serif italic mt-0.5">
                        Defina em detalhe as ações permitidas para este perfil.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      {/* Topic 1: Pastas */}
                      <div className="space-y-1.5 border border-gray-200 p-2.5 bg-white">
                        <span className="font-bold font-serif italic text-[#C2A87E] text-[11px] block border-b border-gray-100 pb-1">
                          1. Pastas do Condomínio
                        </span>
                        <div className="space-y-1 pl-1">
                          <label className="flex items-center gap-2 cursor-pointer py-0.5">
                            <input
                              type="checkbox"
                              checked={userPermissions.folders_view}
                              onChange={(e) =>
                                setUserPermissions({
                                  ...userPermissions,
                                  folders_view: e.target.checked,
                                })
                              }
                              className="accent-[#111111] h-3.5 w-3.5 rounded-none"
                            />
                            <span>Visualizar Pastas</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer py-0.5">
                            <input
                              type="checkbox"
                              checked={userPermissions.folders_create}
                              onChange={(e) =>
                                setUserPermissions({
                                  ...userPermissions,
                                  folders_create: e.target.checked,
                                })
                              }
                              className="accent-[#111111] h-3.5 w-3.5 rounded-none"
                            />
                            <span>Criar Novas Pastas</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer py-0.5">
                            <input
                              type="checkbox"
                              checked={userPermissions.folders_delete}
                              onChange={(e) =>
                                setUserPermissions({
                                  ...userPermissions,
                                  folders_delete: e.target.checked,
                                })
                              }
                              className="accent-[#111111] h-3.5 w-3.5 rounded-none"
                            />
                            <span>Excluir Pastas</span>
                          </label>
                        </div>
                      </div>

                      {/* Topic 2: Arquivos */}
                      <div className="space-y-1.5 border border-gray-200 p-2.5 bg-white">
                        <span className="font-bold font-serif italic text-[#C2A87E] text-[11px] block border-b border-gray-100 pb-1">
                          2. Arquivos e Documentos
                        </span>
                        <div className="space-y-1 pl-1">
                          <label className="flex items-center gap-2 cursor-pointer py-0.5">
                            <input
                              type="checkbox"
                              checked={userPermissions.files_view}
                              onChange={(e) =>
                                setUserPermissions({
                                  ...userPermissions,
                                  files_view: e.target.checked,
                                })
                              }
                              className="accent-[#111111] h-3.5 w-3.5 rounded-none"
                            />
                            <span>Visualizar / Baixar</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer py-0.5">
                            <input
                              type="checkbox"
                              checked={userPermissions.files_upload}
                              onChange={(e) =>
                                setUserPermissions({
                                  ...userPermissions,
                                  files_upload: e.target.checked,
                                })
                              }
                              className="accent-[#111111] h-3.5 w-3.5 rounded-none"
                            />
                            <span>Enviar / Subir Arquivos</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer py-0.5">
                            <input
                              type="checkbox"
                              checked={userPermissions.files_delete}
                              onChange={(e) =>
                                setUserPermissions({
                                  ...userPermissions,
                                  files_delete: e.target.checked,
                                })
                              }
                              className="accent-[#111111] h-3.5 w-3.5 rounded-none"
                            />
                            <span>Excluir Arquivos</span>
                          </label>
                        </div>
                      </div>

                      {/* Topic 3: Protocolos */}
                      <div className="space-y-1.5 border border-gray-200 p-2.5 bg-white">
                        <span className="font-bold font-serif italic text-[#C2A87E] text-[11px] block border-b border-gray-100 pb-1">
                          3. Atendimentos & Chamados
                        </span>
                        <div className="space-y-1 pl-1">
                          <label className="flex items-center gap-2 cursor-pointer py-0.5">
                            <input
                              type="checkbox"
                              checked={userPermissions.protocols_view}
                              onChange={(e) =>
                                setUserPermissions({
                                  ...userPermissions,
                                  protocols_view: e.target.checked,
                                })
                              }
                              className="accent-[#111111] h-3.5 w-3.5 rounded-none"
                            />
                            <span>Visualizar Chamados</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer py-0.5">
                            <input
                              type="checkbox"
                              checked={userPermissions.protocols_create}
                              onChange={(e) =>
                                setUserPermissions({
                                  ...userPermissions,
                                  protocols_create: e.target.checked,
                                })
                              }
                              className="accent-[#111111] h-3.5 w-3.5 rounded-none"
                            />
                            <span>Abrir Novos Chamados</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer py-0.5">
                            <input
                              type="checkbox"
                              checked={userPermissions.protocols_reply}
                              onChange={(e) =>
                                setUserPermissions({
                                  ...userPermissions,
                                  protocols_reply: e.target.checked,
                                })
                              }
                              className="accent-[#111111] h-3.5 w-3.5 rounded-none"
                            />
                            <span>Responder / Interagir</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer py-0.5">
                            <input
                              type="checkbox"
                              checked={userPermissions.protocols_close}
                              onChange={(e) =>
                                setUserPermissions({
                                  ...userPermissions,
                                  protocols_close: e.target.checked,
                                })
                              }
                              className="accent-[#111111] h-3.5 w-3.5 rounded-none"
                            />
                            <span>Encerrar Chamados</span>
                          </label>
                        </div>
                      </div>

                      {/* Topic 4: Cadastros */}
                      <div className="space-y-1.5 border border-gray-200 p-2.5 bg-white">
                        <span className="font-bold font-serif italic text-[#C2A87E] text-[11px] block border-b border-gray-100 pb-1">
                          4. Cadastros & Gestão
                        </span>
                        <div className="space-y-1 pl-1">
                          <label className="flex items-center gap-2 cursor-pointer py-0.5">
                            <input
                              type="checkbox"
                              checked={userPermissions.register_sindicos}
                              onChange={(e) =>
                                setUserPermissions({
                                  ...userPermissions,
                                  register_sindicos: e.target.checked,
                                })
                              }
                              className="accent-[#111111] h-3.5 w-3.5 rounded-none"
                            />
                            <span>Cadastrar Síndicos</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer py-0.5">
                            <input
                              type="checkbox"
                              checked={userPermissions.register_condos}
                              onChange={(e) =>
                                setUserPermissions({
                                  ...userPermissions,
                                  register_condos: e.target.checked,
                                })
                              }
                              className="accent-[#111111] h-3.5 w-3.5 rounded-none"
                            />
                            <span>Cadastrar Condomínios</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer py-0.5">
                            <input
                              type="checkbox"
                              checked={userPermissions.view_audit_logs}
                              onChange={(e) =>
                                setUserPermissions({
                                  ...userPermissions,
                                  view_audit_logs: e.target.checked,
                                })
                              }
                              className="accent-[#111111] h-3.5 w-3.5 rounded-none"
                            />
                            <span>Visualizar Auditoria</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full bg-[#111111] hover:bg-[#C2A87E] text-white font-bold py-3.5 text-xs uppercase tracking-widest transition-colors cursor-pointer rounded-none border border-[#111111]"
                >
                  Cadastrar Usuário
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-2 bg-white p-6 border border-[#111111] rounded-none shadow-none">
            <h3 className="font-serif italic text-xl text-[#111111] mb-6 flex items-center gap-2">
              <Users className="w-5 h-5 text-[#111111]" /> Usuários Cadastrados ({visibleUsers.length})
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b-2 border-[#111111] text-[#111111] font-bold">
                    <th className="py-3 px-4 font-serif italic">Nome / Administradora</th>
                    <th className="py-3 px-4 font-serif italic">E-mail (Acesso)</th>
                    <th className="py-3 px-4 font-serif italic">Permissão</th>
                    <th className="py-3 px-4 font-serif italic">Condomínios Autorizados</th>
                    <th className="py-3 px-4 font-serif italic text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {visibleUsers.map((u) => {
                    const linkedCondos = condominios.filter((c) =>
                      u.condominiumIds?.includes(c.id)
                    );
                    return (
                      <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="py-4 px-4">
                          <div className="font-bold text-[#111111]">{u.name}</div>
                          {u.administradoraId && (
                            <div className="text-[9px] text-[#C2A87E] font-bold uppercase tracking-wider mt-0.5">
                              {administradoras.find((a) => a.id === u.administradoraId)?.name || "Administradora"}
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-4 text-xs text-gray-700">
                          <div className="font-mono">{u.email}</div>
                          <div className="text-[10px] text-gray-400 font-mono mt-1 flex items-center gap-1">
                            <Key className="w-3 h-3 text-gray-400" /> Senha: {u.password}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span
                            className={`px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider border ${
                              u.role === "SuperADM"
                                ? "bg-red-50 text-red-700 border-red-200"
                                : u.role === "Administrador"
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : "bg-green-50 text-green-700 border-green-200"
                            }`}
                          >
                            {u.role === "SuperADM"
                              ? "Super ADM"
                              : u.role === "Administrador"
                              ? "Administradora"
                              : "Síndico"}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-xs text-gray-600">
                          {u.role === "SuperADM" ? (
                            <span className="text-gray-400 font-serif italic">Acesso Total (SuperADM)</span>
                          ) : u.role === "Administrador" ? (
                            <span className="text-gray-400 font-serif italic">Todos da Administradora</span>
                          ) : linkedCondos.length === 0 ? (
                            <span className="text-red-600 font-bold tracking-wide uppercase text-[10px]">[Nenhum condomínio]</span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5 max-w-xs">
                              {linkedCondos.map((lc) => (
                                <span
                                  key={lc.id}
                                  className="bg-[#F4F2EE] text-[#111111] border border-gray-300 text-[9px] font-mono px-2 py-0.5 uppercase"
                                >
                                  {lc.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-4 text-right">
                          <button
                            onClick={() => handleStartEditUser(u)}
                            className="text-[#111111] hover:text-[#C2A87E] p-1.5 border border-transparent hover:border-gray-200 transition-colors mr-2 cursor-pointer"
                            title="Editar Permissões e Dados"
                          >
                            <UserCog className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u.id, u.name, u.email)}
                            className="text-red-700 hover:text-red-950 p-1.5 border border-transparent hover:border-red-200 transition-colors cursor-pointer"
                            disabled={u.id === currentUser.id}
                            title={u.id === currentUser.id ? "Você não pode se excluir" : "Excluir"}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR USUÁRIO & PERMISSÕES */}
      {editingUser && (
        <div id="editUserModal" className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/45 backdrop-blur-xs transition-opacity"
            onClick={() => setEditingUser(null)}
          />
          <div className="relative bg-[#FAF9F6] border border-[#111111] p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-lg z-10 space-y-6">
            <div className="border-b border-[#111111]/10 pb-3 flex justify-between items-center">
              <h3 className="font-serif italic text-xl text-[#111111]">
                Editar Usuário: {editingUser.name}
              </h3>
              <button
                onClick={() => setEditingUser(null)}
                className="text-gray-400 hover:text-[#111111] text-xs uppercase font-bold tracking-widest transition-all cursor-pointer"
              >
                [Fechar]
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div>
                <label className="block text-[9px] font-bold text-[#111111] uppercase tracking-widest mb-1.5">
                  Nome Completo
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border border-[#111111] rounded-none bg-white text-sm outline-none focus:bg-[#F4F2EE]"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-bold text-[#111111] uppercase tracking-widest mb-1.5">
                    E-mail (Acesso)
                  </label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-[#111111] rounded-none bg-white text-sm outline-none focus:bg-[#F4F2EE]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-[#111111] uppercase tracking-widest mb-1.5">
                    Senha Provisória / Atual
                  </label>
                  <input
                    type="text"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-[#111111] rounded-none bg-white text-sm outline-none focus:bg-[#F4F2EE]"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-[#111111] uppercase tracking-widest mb-1.5">
                  Tipo de Permissão
                </label>
                <select
                  value={editRole}
                  onChange={(e) => {
                    const nextRole = e.target.value as "Administrador" | "Sindico";
                    setEditRole(nextRole);
                    setEditPermissions(getRoleDefaultPermissions(nextRole));
                  }}
                  className="w-full px-3 py-2 border border-[#111111] rounded-none bg-white text-sm outline-none focus:bg-[#F4F2EE]"
                  required
                >
                  <option value="Sindico">Síndico (Apenas Visualização por padrão)</option>
                  <option value="Administrador">Administrador (Gestor por padrão)</option>
                </select>
              </div>

              {editRole === "Sindico" && (
                <div>
                  <label className="block text-[9px] font-bold text-[#111111] uppercase tracking-widest mb-1">
                    Liberar Acesso aos Condomínios:
                  </label>
                  <p className="text-[10px] text-gray-500 mb-2 font-serif italic">
                    O síndico só visualizará as pastas dos condomínios marcados abaixo.
                  </p>
                  <div className="max-h-32 overflow-y-auto border border-[#111111] p-2 space-y-1.5 bg-[#F9F8F6]">
                    {visibleCondos.length === 0 ? (
                      <p className="text-xs text-gray-400 p-2 font-serif italic">Nenhum condomínio cadastrado.</p>
                    ) : (
                      visibleCondos.map((c) => (
                        <label
                          key={c.id}
                          className="flex items-center gap-2 p-1.5 hover:bg-white border border-transparent hover:border-gray-200 transition-colors cursor-pointer text-xs font-bold text-gray-800"
                        >
                          <input
                            type="checkbox"
                            checked={editSelectedCondos.includes(c.id)}
                            onChange={() => {
                              if (editSelectedCondos.includes(c.id)) {
                                setEditSelectedCondos(editSelectedCondos.filter(id => id !== c.id));
                              } else {
                                setEditSelectedCondos([...editSelectedCondos, c.id]);
                              }
                            }}
                            className="accent-[#111111] rounded-none h-4 w-4 border-[#111111]"
                          />
                          {c.name}
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Permissões Granulares (Super ADM) */}
              {currentUser.role === "SuperADM" && (
                <div className="border border-[#111111] p-3 space-y-4 bg-[#F9F8F6]">
                  <div>
                    <p className="text-[10px] uppercase font-bold tracking-wider text-[#111111]">
                      Configuração de Permissões Granulares
                    </p>
                    <p className="text-[9px] text-gray-500 font-serif italic mt-0.5">
                      Personalize detalhadamente as permissões deste usuário.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    {/* Topic 1: Pastas */}
                    <div className="space-y-1.5 border border-gray-200 p-2 bg-white">
                      <span className="font-bold font-serif italic text-[#C2A87E] text-[11px] block border-b border-gray-100 pb-0.5">
                        1. Pastas do Condomínio
                      </span>
                      <div className="space-y-1 pl-1">
                        <label className="flex items-center gap-2 cursor-pointer py-0.5">
                          <input
                            type="checkbox"
                            checked={editPermissions.folders_view}
                            onChange={(e) =>
                              setEditPermissions({
                                ...editPermissions,
                                folders_view: e.target.checked,
                              })
                            }
                            className="accent-[#111111] h-3.5 w-3.5 rounded-none"
                          />
                          <span>Visualizar Pastas</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer py-0.5">
                          <input
                            type="checkbox"
                            checked={editPermissions.folders_create}
                            onChange={(e) =>
                              setEditPermissions({
                                ...editPermissions,
                                folders_create: e.target.checked,
                              })
                            }
                            className="accent-[#111111] h-3.5 w-3.5 rounded-none"
                          />
                          <span>Criar Pastas</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer py-0.5">
                          <input
                            type="checkbox"
                            checked={editPermissions.folders_delete}
                            onChange={(e) =>
                              setEditPermissions({
                                ...editPermissions,
                                folders_delete: e.target.checked,
                              })
                            }
                            className="accent-[#111111] h-3.5 w-3.5 rounded-none"
                          />
                          <span>Excluir Pastas</span>
                        </label>
                      </div>
                    </div>

                    {/* Topic 2: Arquivos */}
                    <div className="space-y-1.5 border border-gray-200 p-2 bg-white">
                      <span className="font-bold font-serif italic text-[#C2A87E] text-[11px] block border-b border-gray-100 pb-0.5">
                        2. Arquivos e Documentos
                      </span>
                      <div className="space-y-1 pl-1">
                        <label className="flex items-center gap-2 cursor-pointer py-0.5">
                          <input
                            type="checkbox"
                            checked={editPermissions.files_view}
                            onChange={(e) =>
                              setEditPermissions({
                                ...editPermissions,
                                files_view: e.target.checked,
                              })
                            }
                            className="accent-[#111111] h-3.5 w-3.5 rounded-none"
                          />
                          <span>Visualizar / Baixar</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer py-0.5">
                          <input
                            type="checkbox"
                            checked={editPermissions.files_upload}
                            onChange={(e) =>
                              setEditPermissions({
                                ...editPermissions,
                                files_upload: e.target.checked,
                              })
                            }
                            className="accent-[#111111] h-3.5 w-3.5 rounded-none"
                          />
                          <span>Enviar / Subir</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer py-0.5">
                          <input
                            type="checkbox"
                            checked={editPermissions.files_delete}
                            onChange={(e) =>
                              setEditPermissions({
                                ...editPermissions,
                                files_delete: e.target.checked,
                              })
                            }
                            className="accent-[#111111] h-3.5 w-3.5 rounded-none"
                          />
                          <span>Excluir Arquivos</span>
                        </label>
                      </div>
                    </div>

                    {/* Topic 3: Protocolos */}
                    <div className="space-y-1.5 border border-gray-200 p-2 bg-white">
                      <span className="font-bold font-serif italic text-[#C2A87E] text-[11px] block border-b border-gray-100 pb-0.5">
                        3. Atendimentos & Chamados
                      </span>
                      <div className="space-y-1 pl-1">
                        <label className="flex items-center gap-2 cursor-pointer py-0.5">
                          <input
                            type="checkbox"
                            checked={editPermissions.protocols_view}
                            onChange={(e) =>
                              setEditPermissions({
                                ...editPermissions,
                                protocols_view: e.target.checked,
                              })
                            }
                            className="accent-[#111111] h-3.5 w-3.5 rounded-none"
                          />
                          <span>Visualizar Chamados</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer py-0.5">
                          <input
                            type="checkbox"
                            checked={editPermissions.protocols_create}
                            onChange={(e) =>
                              setEditPermissions({
                                ...editPermissions,
                                protocols_create: e.target.checked,
                              })
                            }
                            className="accent-[#111111] h-3.5 w-3.5 rounded-none"
                          />
                          <span>Abrir Chamados</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer py-0.5">
                          <input
                            type="checkbox"
                            checked={editPermissions.protocols_reply}
                            onChange={(e) =>
                              setEditPermissions({
                                ...editPermissions,
                                protocols_reply: e.target.checked,
                              })
                            }
                            className="accent-[#111111] h-3.5 w-3.5 rounded-none"
                          />
                          <span>Responder / Interagir</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer py-0.5">
                          <input
                            type="checkbox"
                            checked={editPermissions.protocols_close}
                            onChange={(e) =>
                              setEditPermissions({
                                ...editPermissions,
                                protocols_close: e.target.checked,
                              })
                            }
                            className="accent-[#111111] h-3.5 w-3.5 rounded-none"
                          />
                          <span>Encerrar Chamados</span>
                        </label>
                      </div>
                    </div>

                    {/* Topic 4: Cadastros */}
                    <div className="space-y-1.5 border border-gray-200 p-2 bg-white">
                      <span className="font-bold font-serif italic text-[#C2A87E] text-[11px] block border-b border-gray-100 pb-0.5">
                        4. Cadastros & Gestão
                      </span>
                      <div className="space-y-1 pl-1">
                        <label className="flex items-center gap-2 cursor-pointer py-0.5">
                          <input
                            type="checkbox"
                            checked={editPermissions.register_sindicos}
                            onChange={(e) =>
                              setEditPermissions({
                                ...editPermissions,
                                register_sindicos: e.target.checked,
                              })
                            }
                            className="accent-[#111111] h-3.5 w-3.5 rounded-none"
                          />
                          <span>Cadastrar Síndicos</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer py-0.5">
                          <input
                            type="checkbox"
                            checked={editPermissions.register_condos}
                            onChange={(e) =>
                              setEditPermissions({
                                ...editPermissions,
                                register_condos: e.target.checked,
                              })
                            }
                            className="accent-[#111111] h-3.5 w-3.5 rounded-none"
                          />
                          <span>Cadastrar Condomínios</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer py-0.5">
                          <input
                            type="checkbox"
                            checked={editPermissions.view_audit_logs}
                            onChange={(e) =>
                              setEditPermissions({
                                ...editPermissions,
                                view_audit_logs: e.target.checked,
                              })
                            }
                            className="accent-[#111111] h-3.5 w-3.5 rounded-none"
                          />
                          <span>Visualizar Auditoria</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 bg-white hover:bg-gray-100 text-[#111111] text-xs uppercase font-bold tracking-widest border border-[#111111] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#111111] hover:bg-[#C2A87E] text-white text-xs uppercase font-bold tracking-widest border border-[#111111] transition-colors cursor-pointer"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
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
