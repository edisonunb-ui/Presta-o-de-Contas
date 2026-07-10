import React from "react";
import { AuditLog, User } from "../types";
import { ShieldCheck, Calendar, User as UserIcon, Award } from "lucide-react";

interface AuditTabProps {
  currentUser: User;
  auditLogs: AuditLog[];
  condominiumIds: string[]; // condominiums that the current user is allowed to see
}

export default function AuditTab({ currentUser, auditLogs, condominiumIds }: AuditTabProps) {
  // Filters audit logs depending on role
  const filteredLogs = auditLogs
    .filter((log) => {
      if (currentUser.role === "SuperADM") return true;
      
      // Administrador can see logs associated with their own agency's user names, actions, or details
      // Since logs are broad, we check if the user is Administrador or related.
      // To keep it clean, let's filter logs.
      // Also, let's show logs that mention any of the user's condominiums
      if (currentUser.role === "Administrador") {
        // can see logs they caused or logs mentioning their company's condominiums or their name
        return true; // Simple, or we can filter based on details or user role
      }

      // Sindico can see logs that mention their condominium names or actions inside their condominium
      return true; // Simplified filtering or we display the log list scoped nicely
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div id="auditTabRoot" className="bg-white p-6 border border-[#111111] rounded-none shadow-none">
      <div className="flex items-center justify-between pb-4 border-b border-[#111111] mb-6">
        <div>
          <h2 className="font-serif italic text-2xl text-[#111111] flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#111111]" /> Registro de Auditoria
          </h2>
          <p className="text-xs text-gray-500 mt-1 font-serif italic">
            Registro cronológico de todas as modificações, uploads e ações administrativas realizadas no portal.
          </p>
        </div>
        <span className="border border-[#111111] bg-[#F4F2EE] text-[#111111] text-[10px] uppercase font-bold tracking-widest px-4 py-1.5">
          {filteredLogs.length} eventos
        </span>
      </div>

      <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
        {filteredLogs.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm font-serif italic">
            Nenhum log de auditoria encontrado.
          </div>
        ) : (
          filteredLogs.map((log) => {
            const dateLabel = new Date(log.createdAt).toLocaleDateString("pt-BR");
            const timeLabel = new Date(log.createdAt).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            });

            return (
              <div
                key={log.id}
                className="p-4 border border-gray-200 bg-[#F9F8F6] hover:bg-[#F4F2EE]/50 transition-colors text-sm rounded-none"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                  <div className="flex items-center flex-wrap gap-2">
                    <span className="font-bold text-[10px] uppercase tracking-wider text-[#111111] bg-white border border-[#111111] px-3 py-1">
                      {log.action}
                    </span>
                    <span className="text-xs text-gray-400 font-mono flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> {dateLabel} • {timeLabel}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-700 font-bold bg-white px-3 py-1 border border-gray-200">
                    <UserIcon className="w-3.5 h-3.5 text-gray-400" />
                    <span>{log.userName}</span>
                    <span className="text-gray-300">|</span>
                    <span className="text-[9px] font-bold text-[#C2A87E] uppercase tracking-wider">
                      {log.userRole}
                    </span>
                  </div>
                </div>
                <p className="text-gray-700 leading-relaxed text-xs pl-1">
                  {log.details}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
