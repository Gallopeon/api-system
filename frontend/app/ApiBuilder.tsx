"use client";

import React, { useState, useEffect } from "react";
import { Search, Trash2, Plus, Database, Calendar } from "lucide-react";

type ApiDataField = {
  id: string;
  key: string;
  value: string;
};

type SavedRecord = {
  id: string;
  name: string;
  fields: ApiDataField[];
  updatedAt: number;
};

// Pass translation function (t) through props to blend with page.tsx
export default function ApiBuilder({ t }: { t: <T>(en: T, zh: T) => T }) {
  const [savedRecords, setSavedRecords] = useState<SavedRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  
  const [currentRecordId, setCurrentRecordId] = useState<string | null>(null);
  const [recordName, setRecordName] = useState("");
  const [fields, setFields] = useState<ApiDataField[]>([
    { id: crypto.randomUUID(), key: "", value: "" },
  ]);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("apiBuilderRecords");
    if (stored) {
      try {
        setSavedRecords(JSON.parse(stored));
      } catch (e) {}
    }
  }, []);

  const saveToDb = (records: SavedRecord[]) => {
    setSavedRecords(records);
    localStorage.setItem("apiBuilderRecords", JSON.stringify(records));
  };

  const addField = () => {
    setFields([...fields, { id: crypto.randomUUID(), key: "", value: "" }]);
  };

  const removeField = (id: string) => {
    setFields(fields.filter((f) => f.id !== id));
  };

  const updateField = (id: string, keyName: "key" | "value", val: string) => {
    setFields(
      fields.map((f) => (f.id === id ? { ...f, [keyName]: val } : f))
    );
  };

  const handleSave = () => {
    if (!recordName.trim()) {
      alert(t("Please enter a data record name", "请输入接口数据标识名称"));
      return;
    }
    
    // Clean empty fields before saving
    const cleanedFields = fields.filter(f => f.key.trim() !== "" || f.value.trim() !== "");
    const finalFields = cleanedFields.length > 0 ? cleanedFields : [{ id: crypto.randomUUID(), key: "", value: "" }];

    const newRecord: SavedRecord = {
      id: currentRecordId || crypto.randomUUID(),
      name: recordName.trim(),
      fields: finalFields,
      updatedAt: Date.now(),
    };

    if (currentRecordId) {
      saveToDb(savedRecords.map(r => r.id === currentRecordId ? newRecord : r));
    } else {
      saveToDb([newRecord, ...savedRecords]);
      setCurrentRecordId(newRecord.id);
    }
    
    setFields([...finalFields]);
    alert(t("Data saved successfully!", "接口数据保存成功！"));
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(t("Are you sure you want to delete this data record?", "确定要彻底删除此接口数据记录吗？"))) {
      const remaining = savedRecords.filter(r => r.id !== id);
      saveToDb(remaining);
      if (currentRecordId === id) {
        createNewRecord();
      }
    }
  };

  const createNewRecord = () => {
    setCurrentRecordId(null);
    setRecordName("");
    setFields([{ id: crypto.randomUUID(), key: "", value: "" }]);
  };

  const selectRecord = (record: SavedRecord) => {
    setCurrentRecordId(record.id);
    setRecordName(record.name);
    setFields(record.fields.length > 0 ? [...record.fields] : [{ id: crypto.randomUUID(), key: "", value: "" }]);
  };

  const filteredRecords = savedRecords.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in duration-300">
      <div className="mb-6 rounded-xl flex items-center justify-between">
         <div>
           <h1 className="text-3xl font-bold tracking-tight mb-2">{t("API Data Builder", "API 数据构建器")}</h1>
           <p className="text-gray-500">{t("Manage mock data payloads and field mapping references.", "无代码可视化管理、查询、修改接口的数据结构与载荷存储记录。")}</p>
         </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6 items-start">
        
        {/* Left Pane: Library & Query */}
        <div className="w-full md:w-1/3 flex flex-col space-y-4">
          <div className="bg-white dark:bg-black/40 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm p-4 flex flex-col h-[70vh]">
            
            <h2 className="text-lg font-bold mb-4 flex items-center"><Database className="w-5 h-5 mr-2 text-blue-500"/> {t("Stored API Data", "已存储数据记录")}</h2>
            
            <div className="relative mb-4">
              <span className="absolute left-3 top-2.5 text-gray-400"><Search className="w-4 h-4"/></span>
              <input 
                type="text" 
                placeholder={t("Query by name...", "查询接口名称...")} 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              <button 
                onClick={createNewRecord} 
                className={`w-full text-left p-3 rounded-lg border border-dashed transition-colors flex items-center justify-center space-x-2 ${currentRecordId === null ? "border-blue-400 bg-blue-50 text-blue-600 dark:bg-blue-900/20" : "border-gray-300 text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"}`}
              >
                <Plus className="w-4 h-4" /> <span>{t("Create New Data", "新建空接口数据")}</span>
              </button>

              {filteredRecords.map(r => (
                <div 
                  key={r.id} 
                  onClick={() => selectRecord(r)}
                  className={`w-full text-left p-3 rounded-lg border cursor-pointer group transition-colors flex flex-col relative ${currentRecordId === r.id ? "bg-blue-50 border-blue-200 dark:bg-blue-900/40 dark:border-blue-800" : "bg-white border-gray-100 hover:border-gray-300 dark:bg-transparent dark:border-gray-800 dark:hover:bg-gray-800/50"}`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-semibold text-gray-800 dark:text-gray-200 truncate pr-6">{r.name}</span>
                    <button onClick={(e) => handleDelete(r.id, e)} className="absolute right-2 top-3 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-4 h-4"/></button>
                  </div>
                  <div className="flex items-center text-xs text-gray-500"><Calendar className="w-3 h-3 mr-1"/> {new Date(r.updatedAt).toLocaleString()} · {r.fields.length} {t("fields", "个字段")}</div>
                </div>
              ))}

              {filteredRecords.length === 0 && savedRecords.length > 0 && (
                 <div className="text-center text-gray-400 text-sm py-4">{t("No matches found.", "未找到匹配数据")}</div>
              )}
            </div>
          </div>
        </div>

        {/* Right Pane: Editor */}
        <div className="w-full md:w-2/3 bg-white dark:bg-black/40 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm p-4 md:p-6 space-y-4">
           <div className="border-b border-gray-100 dark:border-gray-800 pb-4 mb-4 flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
              <div className="flex-1">
                 <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">{t("Data Record Name", "接口数据标识名称")}</label>
                 <input 
                   type="text" 
                   value={recordName}
                   onChange={(e) => setRecordName(e.target.value)}
                   placeholder={t("e.g. User Profile Response Mock", "例如：商城商品列表 Mock")}
                   className="w-full px-2 py-2 text-lg font-bold bg-transparent border-b-2 border-dashed border-gray-200 hover:border-gray-300 focus:border-blue-500 dark:border-gray-700 outline-none transition-colors"
                 />
              </div>
              
              <div className="flex items-center space-x-3 shrink-0">
                <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                  <button onClick={() => setViewMode("list")} className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${viewMode === "list" ? "bg-white dark:bg-gray-700 shadow text-blue-600 dark:text-blue-400" : "text-gray-500 hover:text-gray-900 dark:hover:text-white"}`}>{t("三 List", "三 列表")}</button>
                  <button onClick={() => setViewMode("grid")} className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${viewMode === "grid" ? "bg-white dark:bg-gray-700 shadow text-blue-600 dark:text-blue-400" : "text-gray-500 hover:text-gray-900 dark:hover:text-white"}`}>{t("▦ Grid", "▦ 网格")}</button>
                </div>
                <button onClick={handleSave} className="inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-blue-500/50 transition">
                  {t("Save Changes", "保存修改")}
                </button>
              </div>
           </div>

           <div>
             {viewMode === "list" ? (
                <div className="space-y-3">
                  {fields.map((field, index) => (
                    <div key={field.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-800 group transition-all hover:shadow-sm">
                      <div className="hidden sm:block text-gray-400 font-mono text-xs w-6 text-center">{index + 1}</div>
                      <input type="text" placeholder={t("Key (e.g., username)", "键名 (例如: username)")} value={field.key} onChange={(e) => updateField(field.id, "key", e.target.value)} className="flex-1 w-full sm:w-0 border border-gray-300 dark:border-gray-700 bg-white dark:bg-black rounded-md shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 px-3 py-2 text-sm outline-none transition-shadow" />
                      <span className="hidden sm:inline text-gray-400">:</span>
                      <input type="text" placeholder={t("Value (e.g., admin)", "值 (例如: admin)")} value={field.value} onChange={(e) => updateField(field.id, "value", e.target.value)} className="flex-1 w-full sm:w-0 border border-gray-300 dark:border-gray-700 bg-white dark:bg-black rounded-md shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 px-3 py-2 text-sm outline-none transition-shadow" />
                      <button onClick={() => removeField(field.id)} className="text-gray-400 hover:text-red-500 p-2 sm:opacity-50 group-hover:opacity-100 transition-opacity flex items-center justify-center self-end sm:self-auto"><span className="sm:hidden text-xs mr-1 text-red-400">Remove</span>✕</button>
                    </div>
                  ))}
                  <button onClick={addField} className="mt-3 flex items-center justify-center w-full py-3 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-500 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                    {t("+ Add new field row", "+ 添加新字段行")}
                  </button>
                </div>
              ) : (
                <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden md:overflow-visible overflow-x-auto">
                  <table className="w-full text-left text-sm table-fixed min-w-[400px]">
                    <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
                      <tr>
                        <th className="px-4 py-3 font-medium text-gray-500 w-[45%] border-r border-gray-200 dark:border-gray-800">KEY / 键名</th>
                        <th className="px-4 py-3 font-medium text-gray-500 w-[45%]">VALUE / 值</th>
                        <th className="w-[10%] text-center">{t("Action", "操作")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                      {fields.map((field) => (
                        <tr key={field.id} className="group hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                          <td className="border-r border-gray-200 dark:border-gray-800">
                            <input type="text" placeholder="key" value={field.key} onChange={(e) => updateField(field.id, "key", e.target.value)} className="w-full px-4 py-2.5 bg-transparent outline-none focus:bg-white dark:focus:bg-gray-800 focus:ring-1 focus:ring-inset focus:ring-blue-500" />
                          </td>
                          <td className="relative group/row">
                            <input type="text" placeholder="value" value={field.value} onChange={(e) => updateField(field.id, "value", e.target.value)} className="w-full px-4 py-2.5 bg-transparent outline-none focus:bg-white dark:focus:bg-gray-800 focus:ring-1 focus:ring-inset focus:ring-blue-500" />
                          </td>
                          <td className="text-center align-middle">
                            <button onClick={() => removeField(field.id)} className="text-gray-400 hover:text-red-500 opacity-50 sm:opacity-0 group-hover:opacity-100 transition-opacity p-1">✕</button>
                          </td>
                        </tr>
                      ))}
                      <tr>
                        <td colSpan={3} className="p-0 border-t border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 text-center">
                          <button onClick={addField} className="w-full py-2.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors flex justify-center items-center">
                            <span>+ {t("Add Row", "添加新行")}</span>
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
           </div>
        </div>

      </div>
    </div>
  );
}