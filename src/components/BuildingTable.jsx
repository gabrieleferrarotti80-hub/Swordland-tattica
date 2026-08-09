import React from 'react';
import { useTranslation } from 'react-i18next'; // 🌍 Import i18n

export const BuildingTable = ({ buildings, onEdit }) => {
  const { t } = useTranslation(); // 🌍 Hook di traduzione

  return (
    <div className="w-full">
      <table className="w-full text-left text-sm border-separate border-spacing-0">
        <thead>
          <tr>
            <th className="sticky top-0 bg-slate-800 text-cyan-400 p-3 font-semibold z-10 border-b-2 border-slate-700 shadow-sm">{t('swordland.building_table.building')}</th>
            <th className="sticky top-0 bg-slate-800 text-cyan-400 p-3 font-semibold text-center z-10 border-b-2 border-slate-700 shadow-sm">{t('swordland.building_table.unlock')}</th>
            <th className="sticky top-0 bg-slate-800 text-cyan-400 p-3 font-semibold text-center z-10 border-b-2 border-slate-700 shadow-sm">{t('swordland.building_table.points_min')}</th>
            <th className="sticky top-0 bg-slate-800 text-cyan-400 p-3 font-semibold text-center z-10 border-b-2 border-slate-700 shadow-sm">{t('swordland.building_table.points_player')}</th>
            <th className="sticky top-0 bg-slate-800 text-cyan-400 p-3 font-semibold text-center z-10 border-b-2 border-slate-700 shadow-sm">{t('swordland.building_table.first_control')}</th>
            <th className="sticky top-0 bg-slate-800 text-blue-400 p-3 font-semibold text-center z-10 border-b-2 border-slate-700 shadow-sm">{t('swordland.building_table.blue_march_sec')}</th>
            <th className="sticky top-0 bg-slate-800 text-red-400 p-3 font-semibold text-center z-10 border-b-2 border-slate-700 shadow-sm">{t('swordland.building_table.red_march_sec')}</th>
          </tr>
        </thead>
        <tbody>
          {buildings.map((b) => (
            <tr key={b.id} className="hover:bg-slate-700/30 transition-colors">
              <td className="p-3 font-medium text-slate-200 border-b border-slate-700/50">{b.name}</td>
              <td className="p-3 text-center border-b border-slate-700/50">
                <input 
                  className="bg-slate-900/50 border border-slate-600 rounded p-1 w-14 text-center text-slate-200 focus:outline-none focus:border-cyan-400 focus:bg-slate-800 transition-colors"
                  type="number" 
                  value={b.unlockTime} 
                  onChange={(e) => onEdit(b.id, 'unlockTime', Number(e.target.value))}
                />
              </td>
              <td className="p-3 text-center border-b border-slate-700/50">
                <input 
                  className="bg-slate-900/50 border border-slate-600 rounded p-1 w-16 text-center text-slate-200 focus:outline-none focus:border-cyan-400 focus:bg-slate-800 transition-colors"
                  type="number" 
                  value={b.pointsPerMin} 
                  onChange={(e) => onEdit(b.id, 'pointsPerMin', Number(e.target.value))}
                />
              </td>
              <td className="p-3 text-center border-b border-slate-700/50">
                <input 
                  className="bg-slate-900/50 border border-slate-600 rounded p-1 w-16 text-center text-slate-200 focus:outline-none focus:border-cyan-400 focus:bg-slate-800 transition-colors"
                  type="number" 
                  value={b.pointsPerMinPlayer} 
                  onChange={(e) => onEdit(b.id, 'pointsPerMinPlayer', Number(e.target.value))}
                />
              </td>
              <td className="p-3 text-center border-b border-slate-700/50">
                <input 
                  className="bg-slate-900/50 border border-slate-600 rounded p-1 w-20 text-center text-slate-200 focus:outline-none focus:border-cyan-400 focus:bg-slate-800 transition-colors"
                  type="number" 
                  value={b.firstControl} 
                  onChange={(e) => onEdit(b.id, 'firstControl', Number(e.target.value))}
                />
              </td>
              
              <td className="p-3 text-center border-b border-slate-700/50">
                <input 
                  className="bg-slate-900/50 border border-slate-600 rounded p-1 w-16 text-center font-bold text-blue-300 focus:outline-none focus:border-blue-400 focus:bg-slate-800 transition-colors"
                  type="number" 
                  value={b.travelTimeBlue || 0} 
                  onChange={(e) => onEdit(b.id, 'travelTimeBlue', Number(e.target.value))}
                />
              </td>

              <td className="p-3 text-center border-b border-slate-700/50">
                <input 
                  className="bg-slate-900/50 border border-slate-600 rounded p-1 w-16 text-center font-bold text-red-300 focus:outline-none focus:border-red-400 focus:bg-slate-800 transition-colors"
                  type="number" 
                  value={b.travelTimeRed || 0} 
                  onChange={(e) => onEdit(b.id, 'travelTimeRed', Number(e.target.value))}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};