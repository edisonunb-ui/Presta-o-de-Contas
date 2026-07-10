import React, { useState } from "react";
import { collection, addDoc, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import { User, Administradora, Condominium } from "../types";
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
    }
  };

  // Submitting Condominium
  const handleCreateCondo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!condoName.trim()) return;
    const finalAdmId = currentUser.role === "SuperADM" ? condoAdmId : currentUser.administradoraId;
    if (!finalAdmId) return;

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
    }
  };

  // Submitting User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userEmail.trim() || !userPassword.trim() || !userName.trim()) return;
    
    const finalAdmId = currentUser.role === "SuperADM" ? userAdmId : currentUser.administradoraId;

    try {
      // Check if email already exists
      const emailExists = usuarios.some(
        u => u.email.toLowerCase() === userEmail.trim().toLowerCase()
      );
      if (emailExists) {
        alert("Este e-mail de usuário já está cadastrado!");
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
      onRefresh();
    } catch (error) {
      console.error(error);
    }
  };

  // Delete handlers
  const handleDeleteAdm = async (id: string, name: string) => {
    if (!confirm(`Tem certeza de que deseja excluir a administradora "${name}"? Isso não excluirá os condomínios vinculados, mas eles ficarão órfãos.`)) return;
    try {
      await deleteDoc(doc(db, "administradoras", id));
      onAddAuditLog("Exclusão de Administradora", `Excluiu a administradora: ${name}`);
      onRefresh();
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteCondo = async (id: string, name: string) => {
    if (!confirm(`Tem certeza de que deseja excluir o condomínio "${name}"?`)) return;
    try {
      await deleteDoc(doc(db, "condominios", id));
      onAddAuditLog("Exclusão de Condomínio", `Excluiu o condomínio: ${name}`);
      onRefresh();
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteUser = async (id: string, name: string, email: string) => {
    if (id === currentUser.id) {
      alert("Você não pode excluir a si mesmo!");
      return;
    }
    if (!confirm(`Tem certeza de que deseja excluir o usuário "${name}" (${email})?`)) return;
    try {
      await deleteDoc(doc(db, "usuarios", id));
      onAddAuditLog("Exclusão de Usuário", `Excluiu o usuário: ${name} (${email})`);
      onRefresh();
    } catch (error) {
      console.error(error);
    }
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
                    onChange={(e) => setUserRole(e.target.value as "Administrador" | "Sindico")}
                    className="w-full px-3 py-2 border border-[#111111] rounded-none bg-white text-sm outline-none focus:bg-[#F4F2EE]"
                    required
                  >
                    <option value="Sindico">Síndico (Apenas Visualização)</option>
                    {currentUser.role === "SuperADM" && (
                      <option value="Administrador">Administrador (Gestor)</option>
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
                            [{u.role}]
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
                            onClick={() => handleDeleteUser(u.id, u.name, u.email)}
                            className="text-red-700 hover:text-red-950 p-1.5 border border-transparent hover:border-red-200 transition-colors"
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
    </div>
  );
}
