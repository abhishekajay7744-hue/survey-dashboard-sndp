import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Home,
  Users,
  PlusCircle,
  Search,
  Save,
  Trash2,
  Menu,
  X,
  FileText,
  Download,
  Edit,
  BookOpen,
  CreditCard,
  User,
  Activity,
  AlertCircle,
  PieChart,
  LogOut,
  Eye,
  EyeOff,
  Upload,
  Phone
} from 'lucide-react';

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Tab = 'dashboard' | 'survey' | 'records' | 'settings' | 'import';

interface User {
  id: number;
  username: string;
}

interface House {
  id?: number;
  house_details: string;
  area: string;
  ration_card_type?: string;
  phone_numbers?: string[];
  created_at?: string;
  members?: Member[];
}

interface Member {
  id?: number;
  name: string;
  gender: string;
  age: number;
  occupation: string;
  education: string;
  membership_details: string;
  blood_group: string;
  phone: string;
  other_details: string;
}



interface Stats {
  totalHouses: number;
  totalMembers: number;
  aplCount: number;
  bplCount: number;
  maleCount: number;
  femaleCount: number;
  studentCount: number;
  ageGroups: {
    children: number;
    adults: number;
    seniors: number;
  };
}
// Custom Autocomplete Input Component
function AutocompleteInput({ value, onChange, suggestions, placeholder, className, required }: {
  value: string;
  onChange: (val: string) => void;
  suggestions: string[];
  placeholder?: string;
  className?: string;
  required?: boolean;
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  const filtered = React.useMemo(() => {
    const q = (value || '').toLowerCase();
    
    // If empty input, show first 15 suggestions to speed up entry
    if (q.length === 0) {
      return suggestions.slice(0, 15);
    }
    
    return suggestions
      .filter(s => s.toLowerCase().includes(q) && s.toLowerCase() !== q)
      .sort((a, b) => a.localeCompare(b))
      .slice(0, 5);
  }, [value, suggestions]);

  const showDropdown = isFocused && filtered.length > 0;

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex(prev => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && highlightIndex >= 0) {
      e.preventDefault();
      onChange(filtered[highlightIndex]);
      setIsFocused(false);
      setHighlightIndex(-1);
    } else if (e.key === 'Escape') {
      setIsFocused(false);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={value}
        required={required}
        onChange={(e) => { onChange(e.target.value); setHighlightIndex(-1); }}
        onFocus={() => setIsFocused(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className || 'form-input'}
        autoComplete="off"
      />
      {showDropdown && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-[300] max-h-[200px] overflow-y-auto animate-fade-in-up" style={{animationDuration: '0.15s'}}>
          {filtered.map((item, idx) => (
            <button
              key={idx}
              type="button"
              className={cn(
                'w-full text-left px-4 py-2.5 text-sm transition-colors border-b border-slate-50 last:border-0',
                idx === highlightIndex ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-slate-700 hover:bg-slate-50'
              )}
              onMouseDown={(e) => { e.preventDefault(); onChange(item); setIsFocused(false); setHighlightIndex(-1); }}
              onMouseEnter={() => setHighlightIndex(idx)}
            >
              <span dangerouslySetInnerHTML={{
                __html: value ? item.replace(
                  new RegExp(`(${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
                  '<strong class="text-emerald-600">$1</strong>'
                ) : item
              }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [stats, setStats] = useState<Stats>({
    totalHouses: 0,
    totalMembers: 0,
    aplCount: 0,
    bplCount: 0,
    maleCount: 0,
    femaleCount: 0,
    studentCount: 0,
    ageGroups: { children: 0, adults: 0, seniors: 0 }
  });
  const [houses, setHouses] = useState<House[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth > 1024);
  const [selectedHouse, setSelectedHouse] = useState<House | null>(null);
  const [isEditingHouse, setIsEditingHouse] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<number | null>(null);
  const [memberEditForm, setMemberEditForm] = useState<Member | null>(null);
  const [houseSearch, setHouseSearch] = useState('');
  const [sortBy, setSortBy] = useState<'area' | 'details' | 'date' | null>('area');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  // Password Visibility Toggle State
  const [showPwd, setShowPwd] = useState(false);
  const [showOldPwd, setShowOldPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  
  // Suggestion State (Global from DB)
  const [globalSuggestions, setGlobalSuggestions] = useState<{
    areas: string[],
    occupations: string[],
    educations: string[],
    memberships: string[],
    blood_groups: string[],
    names: string[],
    other_details: string[]
  }>({ areas: [], occupations: [], educations: [], memberships: [], blood_groups: [], names: [], other_details: [] });

  // Form State
  const [houseForm, setHouseForm] = useState<House>({
    house_details: '',
    area: '',
    ration_card_type: '',
    phone_numbers: ['']
  });
  const [members, setMembers] = useState<Member[]>([{
    name: '',
    gender: 'Male',
    age: 0,
    occupation: '',
    education: '',
    membership_details: '',
    blood_group: '',
    phone: '',
    other_details: ''
  }]);

  const fetchSuggestions = async () => {
    try {
      const res = await fetch('/api/suggestions');
      const data = await res.json();
      setGlobalSuggestions(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchSuggestions();
    }
  }, [user]);

  // Derived identical houses for validation
  const existingHouseMatch = React.useMemo(() => {
    if (!houseForm.house_details) return null;
    const searchStr = houseForm.house_details.toLowerCase().trim();
    if (searchStr.length < 5) return null;
    return houses.find(h => h.house_details.toLowerCase().includes(searchStr) || searchStr.includes(h.house_details.toLowerCase()));
  }, [houseForm.house_details, houses]);

  // Password Change State
  const [pwdForm, setPwdForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [clearPassword, setClearPassword] = useState('');



  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{ open: boolean; message: string; onConfirm: () => void } | null>(null);

  const showConfirm = (message: string, onConfirm: () => void) => {
    setConfirmModal({ open: true, message, onConfirm });
  };

  const filteredAndSortedHouses = React.useMemo(() => {
    return houses
      .filter(h => {
        const q = houseSearch.toLowerCase();
        if (!q) return true;
        const memberMatch = Array.isArray(h.members) && h.members.some(m => m && (
          m.name?.toLowerCase().includes(q) ||
          m.phone?.toLowerCase().includes(q) ||
          m.occupation?.toLowerCase().includes(q)
        ));
        return (h.house_details || '').toLowerCase().includes(q) ||
          (h.area || '').toLowerCase().includes(q) ||
          (h.ration_card_type || '').toLowerCase().includes(q) ||
          memberMatch;
      })
      .sort((a, b) => {
        if (!sortBy) return 0;
        let valA = '';
        let valB = '';
        if (sortBy === 'area') { valA = a.area || ''; valB = b.area || ''; }
        else if (sortBy === 'details') { valA = a.house_details || ''; valB = b.house_details || ''; }
        else if (sortBy === 'date') { valA = a.created_at || ''; valB = b.created_at || ''; }
        
        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
  }, [houses, houseSearch, sortBy, sortOrder]);



  useEffect(() => {
    const handleResize = () => {
      const desktop = window.innerWidth > 1024;
      setIsDesktop(desktop);
      if (desktop) setIsSidebarOpen(true);
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      });
      const data = await res.json();
      if (data.success) {
        setUser(data.user);
        fetchStats();
        fetchHouses();
        fetchSuggestions();
      } else {
        setLoginError(data.error || 'Invalid username or password');
      }
    } catch (err) {
      setLoginError('Cannot connect to server. Please make sure the server is running.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      alert("Passwords don't match");
      return;
    }
    try {
      const res = await fetch('/api/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: user?.username,
          oldPassword: pwdForm.oldPassword,
          newPassword: pwdForm.newPassword
        })
      });
      const data = await res.json();
      if (data.success) {
        alert('Password changed successfully');
        setPwdForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
        setActiveTab('dashboard');
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert('Failed to change password');
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats');
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchHouses = async () => {
    try {
      const res = await fetch('/api/houses');
      const data = await res.json();
      if (Array.isArray(data)) {
        setHouses(data);
      } else {
        console.error("Houses data is not an array:", data);
        setHouses([]);
      }
    } catch (err) {
      console.error("Houses fetch error:", err);
      setHouses([]);
    }
  };

  const handleAddMember = () => {
    setMembers([{
      name: '',
      gender: 'Male',
      age: 0,
      occupation: '',
      education: '',
      membership_details: '',
      blood_group: '',
      phone: '',
      other_details: ''
    }, ...members]);
  };

  const handleRemoveMember = (index: number) => {
    showConfirm('Remove this member from the form?', () => {
      setMembers(members.filter((_, i) => i !== index));
    });
  };

  const handleMemberChange = (index: number, field: keyof Member, value: any) => {
    const newMembers = [...members];
    newMembers[index] = { ...newMembers[index], [field]: value };
    setMembers(newMembers);
  };

  const handleSubmitSurvey = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ house: houseForm, members })
      });
      if (res.ok) {
        alert('Survey data saved successfully!');
        setHouseForm({ house_details: '', area: '', ration_card_type: '', phone_numbers: [''] });
        setMembers([{
          name: '',
          gender: 'Male',
          age: 0,
          occupation: '',
          education: '',
          membership_details: '',
          blood_group: '',
          phone: '',
          other_details: ''
        }]);
        fetchStats();
        fetchHouses();
        fetchSuggestions();
        setActiveTab('dashboard');
      } else {
        const errData = await res.json().catch(() => ({}));
        alert('Failed to save data: ' + (errData.error || 'Server error occurred'));
      }
    } catch (err: any) {
      console.error(err);
      alert('Network error: ' + (err.message || 'Check your connection'));
    }
  };



  const generateHousePDF = async (house: House) => {
    let fullHouse = house;
    // Fetch members if not already loaded (empty slots check)
    if (house.id && (!house.members || house.members.every(m => m === undefined))) {
      const res = await fetch(`/api/houses/${house.id}/members`);
      const members = await res.json();
      fullHouse = { ...house, members };
    }

    const doc = new jsPDF();
    const primaryColor: [number, number, number] = [30, 41, 59]; // Slate 800
    const accentColor: [number, number, number] = [16, 185, 129]; // Emerald 500

    // ... (rest of header setup)
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('SNDP YOGAM', 105, 15, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('SHAKHA 1176 PIRAPPANCODE - FAMILY SURVEY REPORT', 105, 22, { align: 'center' });
    
    doc.setDrawColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.setLineWidth(1.5);
    doc.line(40, 28, 170, 28);

    // --- House Details Section ---
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Family Information', 14, 55);
    
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(14, 58, 196, 58);

    autoTable(doc, {
      startY: 62,
      body: [
        ['Address & Details:', fullHouse.house_details],
        ['Area / Locality:', fullHouse.area],
        ['Ration Card:', fullHouse.ration_card_type || 'Not Specified'],
        ['Survey Date:', new Date(fullHouse.created_at || '').toLocaleDateString()],
        ['Total Members:', (fullHouse.members?.length || 0).toString()]
      ],
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 2 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } }
    });

    // --- Members Table ---
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Family Member List', 14, (doc as any).lastAutoTable.finalY + 15);

    const tableColumn = ["Name", "Gend", "Age", "Job / Edu", "Member", "Blood", "Phone", "Other Details"];
    const tableRows = fullHouse.members?.map(m => [
      m.name,
      m.gender === 'Male' ? 'M' : m.gender === 'Female' ? 'F' : 'O',
      m.age,
      m.occupation || m.education || '-',
      m.membership_details,
      m.blood_group,
      m.phone,
      m.other_details || '-'
    ]);

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 20,
      head: [tableColumn],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: primaryColor, textColor: 255, halign: 'center', fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 3, textColor: 50 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 'auto' },
        2: { halign: 'center' },
        6: { halign: 'center' }
      }
    });

    // --- Footer ---
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Generated by SNDP Survey System | Page ${i} of ${pageCount}`, 105, 285, { align: 'center' });
    }

    doc.save(`${house.house_details.slice(0, 20)}_family_report.pdf`);
  };

  const generateAllRecordsPDF = async () => {
    let allData: House[] = [];
    try {
      const res = await fetch('/api/export');
      allData = await res.json();
    } catch (err) {
      console.error("Export failed, falling back to current view data", err);
      allData = houses; // Fallback to currently loaded houses if export fails
    }

    const doc = new jsPDF('l', 'mm', 'a4'); 
    
    // --- Stats Calculation for Cover ---
    const totalHouses = allData.length;
    const totalMembers = allData.reduce((s, h) => s + (h.members?.length || 0), 0);
    const aplCount = allData.filter(h => h.ration_card_type === 'APL').length;
    const bplCount = allData.filter(h => h.ration_card_type === 'BPL' || h.ration_card_type === 'AAY').length;

    const areaGroups: { [key: string]: House[] } = {};
    allData.forEach(h => {
      const area = h.area || 'Other / Not Specified';
      if (!areaGroups[area]) areaGroups[area] = [];
      areaGroups[area].push(h);
    });
    const sortedAreas = Object.keys(areaGroups).sort();

    // --- Clean Structural Executive Cover ---
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.rect(10, 10, 277, 190); // Simple professional border

    // Header bar matching other pages
    doc.setFillColor(15, 23, 42); // Deep Navy
    doc.rect(10, 10, 277, 25, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('SNDP SHAKHA 1176 PIRAPPANCODE', 148.5, 26, { align: 'center' });
    
    doc.setTextColor(16, 185, 129); // Emerald Green Sub-header
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('MASTER HOUSEHOLD SURVEY RECORDS', 148.5, 45, { align: 'center' });

    doc.setTextColor(100, 116, 139); // Slate 500
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const totalCountString = `Total Registered Households: ${totalHouses} households • Total Resident Count: ${totalMembers} individuals`;
    doc.text(totalCountString, 148.5, 52, { align: 'center' });

    // --- Structured Category Tables (Perfectly Aligned) ---
    const tableWidth = 140; // Uniform width for both tables
    const tableX = (297 - tableWidth) / 2;

    autoTable(doc, {
      startY: 65,
      margin: { left: tableX, right: tableX },
      tableWidth: tableWidth,
      head: [[{ content: 'EXECUTIVE DATA SUMMARY', colSpan: 2, styles: { halign: 'center', fillColor: [15, 23, 42] } }]],
      body: [
        ["Total Recorded Households", totalHouses.toString()],
        ["Total Resident Population", totalMembers.toString()],
        ["APL Households", aplCount.toString()],
        ["BPL Households", bplCount.toString()]
      ],
      theme: 'grid',
      headStyles: { textColor: 255, fontStyle: 'bold', fontSize: 10, cellPadding: 3 },
      styles: { fontSize: 9, cellPadding: 3.5, halign: 'left' },
      columnStyles: { 1: { halign: 'center', fontStyle: 'bold', cellWidth: 35 } }
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 12,
      margin: { left: tableX, right: tableX },
      tableWidth: tableWidth,
      head: [[{ content: 'REGIONAL POPULATION DISTRIBUTION', colSpan: 2, styles: { halign: 'center', fillColor: [15, 23, 42] } }]],
      body: sortedAreas.map(area => [area.toUpperCase(), `${areaGroups[area].length} Houses`]),
      theme: 'striped',
      headStyles: { textColor: 255, fontStyle: 'bold', fontSize: 10, cellPadding: 3 },
      styles: { fontSize: 9, cellPadding: 3, halign: 'left' },
      columnStyles: { 1: { halign: 'center', cellWidth: 35 } }
    });

    doc.setFontSize(9);
    doc.setTextColor(150);
    doc.text(`Official Document Registry • Generated: ${new Date().toLocaleString()}`, 148.5, 190, { align: 'center' });

    // --- Content Pages ---
    let globalHouseCount = 1;
    sortedAreas.forEach((area) => {
      doc.addPage();
      const areaHouses = areaGroups[area];
      const totalPeople = areaHouses.reduce((sum, h) => sum + (h.members?.length || 0), 0);

      // Simple, Clean Page Layout (No Watermark)
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.rect(5, 5, 287, 200); 

      doc.setFillColor(15, 23, 42); 
      doc.rect(10, 10, 277, 25, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text(area.toUpperCase(), 20, 22);
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`LOCATION SURVEY RECORD - DETAIL VIEW`, 20, 28);
      
      doc.setFillColor(30, 41, 59);
      doc.rect(230, 12, 52, 21, 'F');
      doc.setFontSize(8);
      doc.text('SECTION SUMMARY', 234, 18);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`${areaHouses.length} Houesholds`, 234, 24);
      doc.text(`${totalPeople} People`, 234, 30);

      doc.setTextColor(0, 0, 0);

      areaHouses.forEach((h, hIdx) => {
        const lastY = (doc as any).lastAutoTable?.finalY;
        const hStartY = (hIdx === 0) ? 45 : (lastY ? lastY + 12 : 45);

        doc.setDrawColor(16, 185, 129);
        doc.setLineWidth(1.5);
        doc.line(14, hStartY, 14, hStartY + 10);
        
        autoTable(doc, {
          startY: hStartY,
          margin: { left: 14, right: 14 },
          head: [
            [{ content: `${globalHouseCount++}. HOUSE: ${h.house_details}`, colSpan: 8, styles: { fillColor: [248, 250, 252], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 10, cellPadding: 3 } }],
            ["Name", "Gen", "Age", "Job / Education", "Membership", "Blood", "Phone", "Other Details"]
          ],
          body: h.members?.map(m => [
            m.name, m.gender[0], m.age || '-', m.occupation || m.education || '-', m.membership_details || '-', m.blood_group || '-', m.phone || '-', m.other_details || '-'
          ]) || [],
          theme: 'grid',
          headStyles: { fillColor: [51, 65, 85], textColor: 255, fontSize: 8, cellPadding: 2, lineWidth: 0.1 },
          styles: { fontSize: 8, cellPadding: 2.5, minCellHeight: 8 },
          alternateRowStyles: { fillColor: [252, 252, 252] },
          pageBreak: 'auto'
        });
      });
    });

    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 2; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Official Master Records • Page ${i} of ${pageCount}`, 287, 203, { align: 'right' });
    }

    doc.save('shakha_1176_survey_master_report.pdf');
  };


  const handleClearData = async () => {
    if (!clearPassword) {
      alert('Please enter your admin password to clear data.');
      return;
    }
    if (!user) return;

    showConfirm('WARNING: This will permanently delete ALL survey records. This action cannot be undone!', async () => {
      try {
        const res = await fetch('/api/clear-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: user.username, password: clearPassword })
        });
        const data = await res.json();
        if (data.success) {
          alert('Database cleared successfully.');
          setClearPassword('');
          fetchStats();
          fetchHouses();
        } else {
          alert(data.error || 'Failed to clear data');
        }
      } catch (err) {
        console.error(err);
        alert('Failed to clear data');
      }
    });
  };

  const generateDashboardPDF = () => {
    try {
      const doc = new jsPDF();
      const primaryColor: [number, number, number] = [30, 41, 59];
      const accentColor: [number, number, number] = [16, 185, 129];

      // Header
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(0, 0, 210, 40, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text('EXECUTIVE DASHBOARD SUMMARY', 105, 18, { align: 'center' });
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('SNDP SHAKHA 1176 PIRAPPANCODE', 105, 28, { align: 'center' });

      // Info Cards (Visual Representation)
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(14);
      doc.text('Key Statistical Overview', 14, 55);
      doc.setDrawColor(200, 200, 200);
      doc.line(14, 58, 196, 58);

      autoTable(doc, {
        startY: 65,
        head: [['Metric', 'Value', 'Metric', 'Value']],
        body: [
          ['Total Households', stats.totalHouses, 'Total Members', stats.totalMembers],
          ['Male Members', stats.maleCount, 'Female Members', stats.femaleCount],
          ['APL Households', stats.aplCount, 'BPL Households', stats.bplCount],
          ['Students', stats.studentCount, 'Seniors (60+)', stats.ageGroups.seniors]
        ],
        theme: 'grid',
        headStyles: { fillColor: primaryColor },
        styles: { fontSize: 10, cellPadding: 4 }
      });

      // Distribution Sections
      doc.setFontSize(14);
      doc.text('Demographic Breakdown', 14, (doc as any).lastAutoTable.finalY + 15);
      
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 20,
        head: [['Category', 'Count', 'Percentage']],
        body: [
          ['Children (< 18)', stats.ageGroups.children, `${((stats.ageGroups.children / stats.totalMembers) * 100 || 0).toFixed(1)}%`],
          ['Adults (18-60)', stats.ageGroups.adults, `${((stats.ageGroups.adults / stats.totalMembers) * 100 || 0).toFixed(1)}%`],
          ['Seniors (60+)', stats.ageGroups.seniors, `${((stats.ageGroups.seniors / stats.totalMembers) * 100 || 0).toFixed(1)}%`],
        ],
        theme: 'striped',
        headStyles: { fillColor: accentColor },
        styles: { fontSize: 10 }
      });

      // Footer
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Report generated on ${new Date().toLocaleString()}`, 14, 280);
      doc.text('SNDP Survey Management Tool v1.0', 196, 280, { align: 'right' });

      doc.save('sndp_dashboard_report.pdf');
    } catch (error) {
      console.error("PDF Generation Error:", error);
      alert("Failed to generate PDF. Please try again.");
    }
  };

  const handleDeleteHouse = (id: number) => {
    showConfirm('Are you sure you want to delete this house and all its members? This action cannot be undone.', async () => {
      try {
        const res = await fetch(`/api/houses/${id}`, { method: 'DELETE' });
        if (res.ok) {
          fetchStats();
          fetchHouses();
          setSelectedHouse(null);
        }
      } catch (err) {
        console.error(err);
        alert('Failed to delete house');
      }
    });
  };

  const handleUpdateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberEditForm || !editingMemberId || !selectedHouse) return;
    try {
      const isNew = editingMemberId === -1;
      const url = isNew ? `/api/houses/${selectedHouse.id}/members` : `/api/members/${editingMemberId}`;
      const method = isNew ? 'POST' : 'PUT';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(memberEditForm)
      });
      if (res.ok) {
        alert(isNew ? 'New member added!' : 'Member updated!');
        setEditingMemberId(null);
        setMemberEditForm(null);
        fetchHouses();
        fetchSuggestions();
        if (isNew) fetchStats();
        // Fetch fresh members for the selected house to avoid crash
        if (selectedHouse?.id) {
          try {
            const membersRes = await fetch(`/api/houses/${selectedHouse.id}/members`);
            const freshMembers = await membersRes.json();
            setSelectedHouse(prev => prev ? { ...prev, members: Array.isArray(freshMembers) ? freshMembers : [] } : null);
          } catch (err) {
            console.error('Error refreshing members:', err);
          }
        }
      } else {
        const errorData = await res.json();
        alert(errorData.error || 'Operation failed');
      }
    } catch (err) {
      console.error(err);
      alert(editingMemberId === -1 ? 'Failed to add member' : 'Failed to update member');
    }
  };

  const handleDeleteMember = (id: number) => {
    showConfirm('Are you sure you want to delete this member? This action cannot be undone.', async () => {
      try {
        const res = await fetch(`/api/members/${id}`, { method: 'DELETE' });
        if (res.ok) {
          await fetchStats();
          fetchHouses();
          // Fetch fresh members for the selected house to avoid crash
          if (selectedHouse?.id) {
            try {
              const membersRes = await fetch(`/api/houses/${selectedHouse.id}/members`);
              const freshMembers = await membersRes.json();
              const membersList = Array.isArray(freshMembers) ? freshMembers : [];
              if (membersList.length === 0) {
                setSelectedHouse(null); // Close modal if no members left
              } else {
                setSelectedHouse(prev => prev ? { ...prev, members: membersList } : null);
              }
            } catch (err) {
              console.error('Error refreshing members:', err);
            }
          }
        }
      } catch (err) {
        console.error('Delete member error:', err);
        alert('Failed to delete member');
      }
    });
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
        {/* Background Decorative Elements */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px]"></div>
        
        <div className="w-full max-w-[440px] relative z-10">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-10 shadow-2xl shadow-black/50">
            <div className="flex flex-col items-center mb-7 sm:mb-10">
              <div className="bg-emerald-500 w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center mb-4 sm:mb-6 shadow-lg shadow-emerald-500/20 rotate-3 transition-transform hover:rotate-0 duration-300">
                <LayoutDashboard size={28} className="text-white" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight text-center">SNDP SURVEY</h1>
              <p className="text-slate-400 text-xs sm:text-sm mt-2 sm:mt-3 font-medium uppercase tracking-widest text-center">Digital Administration Portal</p>
              <div className="w-10 h-1 bg-emerald-500 rounded-full mt-3 sm:mt-4"></div>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-4">
                <div className="group">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Identity</label>
                  <input
                    type="text"
                    required
                    autoComplete="username"
                    value={loginForm.username}
                    onChange={(e) => { setLoginForm({ ...loginForm, username: e.target.value }); setLoginError(''); }}
                    className="w-full bg-slate-800/50 border border-slate-700 text-white px-4 py-3.5 sm:px-5 sm:py-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all placeholder:text-slate-600 text-base"
                    placeholder="Username"
                  />
                </div>
                <div className="group">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Security Pin</label>
                  <div className="relative">
                    <input
                      type={showPwd ? "text" : "password"}
                      required
                      autoComplete="current-password"
                      value={loginForm.password}
                      onChange={(e) => { setLoginForm({ ...loginForm, password: e.target.value }); setLoginError(''); }}
                      className="w-full bg-slate-800/50 border border-slate-700 text-white px-4 py-3.5 sm:px-5 sm:py-4 pr-12 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all placeholder:text-slate-600 text-base"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd(!showPwd)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-emerald-400 transition-colors"
                    >
                      {showPwd ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>
              </div>

              {loginError && (
                <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{loginError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full py-3.5 sm:py-4 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-400 active:scale-[0.98] transition-all shadow-xl shadow-emerald-900/20 flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loginLoading ? (
                  <>
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    Signing In...
                  </>
                ) : (
                  <>
                    Access Dashboard
                    <PlusCircle size={18} className="rotate-45 group-hover:rotate-90 transition-transform" />
                  </>
                )}
              </button>
            </form>

            <p className="text-center text-slate-500 text-xs mt-6 sm:mt-8 font-medium">
              Shakha 1176 Pirappancode • Official Community Use Only
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden relative">
      {/* Sidebar Overlay for Mobile */}
      {!isDesktop && isSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "bg-slate-900 text-white transition-all duration-300 flex flex-col z-50",
        isDesktop ? (isSidebarOpen ? "w-64" : "w-20") : (isSidebarOpen ? "fixed inset-y-0 left-0 w-72" : "fixed inset-y-0 -left-72 w-72")
      )}>
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
          <div className="bg-emerald-500 p-2 rounded-lg">
            <LayoutDashboard size={24} />
          </div>
          {isSidebarOpen && <span className="font-bold text-lg tracking-tight">SNDP Survey</span>}
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <SidebarItem
            icon={<LayoutDashboard size={20} />}
            label="Dashboard"
            active={activeTab === 'dashboard'}
            collapsed={!isSidebarOpen}
            onClick={() => setActiveTab('dashboard')}
          />
          <SidebarItem
            icon={<PlusCircle size={20} />}
            label="New Survey"
            active={activeTab === 'survey'}
            collapsed={!isSidebarOpen}
            onClick={() => setActiveTab('survey')}
          />
          <SidebarItem
            icon={<Home size={20} />}
            label="House Records"
            active={activeTab === 'records'}
            collapsed={!isSidebarOpen && isDesktop}
            onClick={() => { setActiveTab('records'); if (!isDesktop) setIsSidebarOpen(false); }}
          />
          <SidebarItem
            icon={<Users size={20} />}
            label="Settings"
            active={activeTab === 'settings'}
            collapsed={!isSidebarOpen && isDesktop}
            onClick={() => { setActiveTab('settings'); if (!isDesktop) setIsSidebarOpen(false); }}
          />
          <SidebarItem
            icon={<Upload size={20} />}
            label="Import Data"
            active={activeTab === 'import'}
            collapsed={!isSidebarOpen && isDesktop}
            onClick={() => { setActiveTab('import'); if (!isDesktop) setIsSidebarOpen(false); }}
          />
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button
            onClick={() => setUser(null)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200 group"
          >
            <LogOut size={20} className="group-hover:translate-x-1 transition-transform" />
            {(isSidebarOpen || !isDesktop) && <span className="font-semibold">Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto w-full scroll-smooth bg-[#f8fafc] pb-16 md:pb-0">

        <header className="bg-white/90 backdrop-blur-xl border-b border-slate-200/60 px-4 py-3 flex justify-between items-center sticky top-0 z-40 shadow-sm shadow-slate-200/50">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {!isDesktop && (
              <button onClick={() => setIsSidebarOpen(true)} className="p-2 hover:bg-slate-100 rounded-lg shrink-0">
                <Menu size={22} />
              </button>
            )}
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none">Survey Management</span>
              <h1 className="text-base md:text-xl font-black bg-gradient-to-r from-slate-900 via-emerald-800 to-emerald-600 bg-clip-text text-transparent truncate">
                SNDP SHAKHA 1176
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex flex-col items-end hidden sm:flex">
              <span className="text-sm font-bold text-slate-900">{user.username}</span>
              <span className="text-[10px] text-slate-500 font-medium">Administrator</span>
            </div>
            <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-emerald-100 shrink-0">
              {user.username[0].toUpperCase()}
            </div>
          </div>
        </header>

        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              {/* Dashboard Actions */}
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-[2rem] blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
                <div className="relative bg-slate-900 p-6 md:p-12 rounded-[2rem] shadow-2xl border border-slate-800 overflow-hidden">
                  <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-[80px]"></div>
                  <div className="relative z-10 flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-widest rounded-full">
                        System Active
                      </span>
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                    </div>
                    <h2 className="text-2xl sm:text-4xl md:text-5xl font-black text-white tracking-tighter">
                      NAMASKARAM <span className="text-emerald-500">ADMIN</span>
                    </h2>
                    <p className="text-slate-400 text-sm md:text-lg leading-relaxed font-medium">
                      Welcome to your Control Center.
                      <span className="text-white ml-1">Shakha 1176 Pirappancode.</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                  title="Total Households"
                  value={stats.totalHouses}
                  icon={<Home size={24} className="text-blue-500" />}
                  color="blue"
                  trend="Family Units"
                />
                <StatCard
                  title="Total Population"
                  value={stats.totalMembers}
                  icon={<Users size={24} className="text-emerald-500" />}
                  color="emerald"
                  trend="Verified Members"
                />
                <StatCard
                  title="Male Distribution"
                  value={stats.maleCount}
                  icon={<User size={24} className="text-sky-500" />}
                  color="sky"
                  trend={`${((stats.maleCount / stats.totalMembers) * 100 || 0).toFixed(1)}% Ratio`}
                />
                <StatCard
                  title="Female Distribution"
                  value={stats.femaleCount}
                  icon={<User size={24} className="text-rose-500" />}
                  color="rose"
                  trend={`${((stats.femaleCount / stats.totalMembers) * 100 || 0).toFixed(1)}% Ratio`}
                />
                <StatCard
                  title="APL Households"
                  value={stats.aplCount}
                  icon={<CreditCard size={24} className="text-indigo-500" />}
                  color="indigo"
                  trend="Priority Access"
                />
                <StatCard
                  title="BPL / AAY Units"
                  value={stats.bplCount}
                  icon={<CreditCard size={24} className="text-amber-500" />}
                  color="amber"
                  trend="Special Support"
                />
                <StatCard
                  title="Academic Base"
                  value={stats.studentCount}
                  icon={<BookOpen size={24} className="text-teal-500" />}
                  color="teal"
                  trend="Active Students"
                />
                <StatCard
                  title="Senior Vitals"
                  value={stats.ageGroups.seniors}
                  icon={<Activity size={24} className="text-slate-500" />}
                  color="slate"
                  trend="Age 60+ Records"
                />
              </div>


              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
                {/* Demographic Insights */}
                <div className="dashboard-card animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h3 className="text-xl font-black text-slate-900">Population Vitals</h3>
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Age Distribution Overview</p>
                    </div>
                    <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600">
                      <Activity size={20} />
                    </div>
                  </div>
                  
                  <div className="space-y-6">
                    <div className="group">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="font-bold text-slate-600">Children (&lt;18)</span>
                        <span className="font-black text-slate-900">{stats.ageGroups.children}</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 rounded-full transition-all duration-1000 ease-out group-hover:bg-emerald-400" 
                          style={{ width: `${(stats.ageGroups.children / stats.totalMembers) * 100 || 0}%` }}
                        ></div>
                      </div>
                    </div>
                    
                    <div className="group">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="font-bold text-slate-600">Adults (18-60)</span>
                        <span className="font-black text-slate-900">{stats.ageGroups.adults}</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 rounded-full transition-all duration-1000 ease-out group-hover:bg-blue-400" 
                          style={{ width: `${(stats.ageGroups.adults / stats.totalMembers) * 100 || 0}%` }}
                        ></div>
                      </div>
                    </div>
                    
                    <div className="group">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="font-bold text-slate-600">Seniors (60+)</span>
                        <span className="font-black text-slate-900">{stats.ageGroups.seniors}</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-amber-500 rounded-full transition-all duration-1000 ease-out group-hover:bg-amber-400" 
                          style={{ width: `${(stats.ageGroups.seniors / stats.totalMembers) * 100 || 0}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Actions / Summary */}
                <div className="dashboard-card animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h3 className="text-xl font-black text-slate-900">Export Engine</h3>
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Report Management</p>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-2xl text-blue-600">
                      <Download size={20} />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4">
                    <button
                      onClick={generateDashboardPDF}
                      className="flex items-center justify-between p-5 bg-slate-50 hover:bg-emerald-500 hover:text-white rounded-[2rem] border border-slate-100 transition-all duration-300 group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-slate-400 group-hover:text-emerald-500 shadow-sm transition-colors">
                          <FileText size={20} />
                        </div>
                        <div className="text-left">
                          <p className="font-bold text-sm">Dashboard Report</p>
                          <p className="text-[10px] opacity-70 font-medium">Download current statistics (PDF)</p>
                        </div>
                      </div>
                      <PlusCircle className="rotate-45" size={20} />
                    </button>
                    
                    <button
                      onClick={() => setActiveTab('records')}
                      className="flex items-center justify-between p-5 bg-slate-50 hover:bg-slate-900 hover:text-white rounded-[2rem] border border-slate-100 transition-all duration-300 group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-slate-400 group-hover:text-slate-900 shadow-sm transition-colors">
                          <Home size={20} />
                        </div>
                        <div className="text-left">
                          <p className="font-bold text-sm">Master Household List</p>
                          <p className="text-[10px] opacity-70 font-medium">Manage all survey entries</p>
                        </div>
                      </div>
                      <PlusCircle className="rotate-45" size={20} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Bottom Decoration */}
              <div className="flex justify-center pt-8">
                <div className="flex items-center gap-4 px-6 py-2 bg-white/50 backdrop-blur-sm border border-slate-200 rounded-full text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                  Official Digital Portal • Pirappancode 1176
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'survey' && (
            <form onSubmit={handleSubmitSurvey} className="space-y-8">
              {/* House Details Section */}
              <section className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3 mb-8">
                  <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                    <Home size={24} />
                  </div>
                  <h2 className="text-xl font-bold">House Information</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField label="House Details (Name & Address)" className="md:col-span-2" required>
                    <textarea
                      required
                      value={houseForm.house_details}
                      onChange={(e) => setHouseForm({ ...houseForm, house_details: e.target.value })}
                      className="form-input min-h-[120px]"
                      placeholder="Enter House Name and Full Address..."
                    />
                    {existingHouseMatch && (
                      <div className="mt-3 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl flex items-start gap-3 text-sm shadow-sm transition-all duration-300">
                        <AlertCircle className="shrink-0 text-amber-500 mt-0.5" size={18} />
                        <div>
                          <strong className="block mb-1 text-amber-900">Possible Duplicate Entry Detected!</strong>
                          This looks similar to an existing record:
                          <div className="mt-1 font-medium bg-white/50 px-2 py-1 rounded inline-block border border-amber-100/50">
                            {existingHouseMatch.house_details} ({existingHouseMatch.area})
                          </div>
                        </div>
                      </div>
                    )}
                  </FormField>
                  <FormField label="Area / Locality">
                    <AutocompleteInput
                      value={houseForm.area}
                      onChange={(val) => setHouseForm({ ...houseForm, area: val })}
                      suggestions={globalSuggestions.areas || []}
                      placeholder="e.g. Alappuzha North"
                      className="form-input"
                    />
                  </FormField>
                  <FormField label="Ration Card Type">
                    <select
                      value={houseForm.ration_card_type}
                      onChange={(e) => setHouseForm({ ...houseForm, ration_card_type: e.target.value })}
                      className="form-input"
                    >
                      <option value="">Select Card Type</option>
                      <option>APL</option>
                      <option>BPL</option>
                      <option>Other</option>
                    </select>
                  </FormField>
                  <FormField label="House Phone Number(s)" className="md:col-span-2">
                    <div className="space-y-2">
                      {(houseForm.phone_numbers || ['']).map((ph, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <div className="relative flex-1">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                            <input
                              type="tel"
                              value={ph}
                              onChange={(e) => {
                                const next = [...(houseForm.phone_numbers || [''])];
                                next[idx] = e.target.value;
                                setHouseForm({ ...houseForm, phone_numbers: next });
                              }}
                              className="form-input pl-9"
                              placeholder={`Phone number ${idx + 1}`}
                            />
                          </div>
                          {(houseForm.phone_numbers || []).length > 1 && (
                            <button type="button" onClick={() => {
                              const next = (houseForm.phone_numbers || []).filter((_, i) => i !== idx);
                              setHouseForm({ ...houseForm, phone_numbers: next });
                            }} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                              <X size={16} />
                            </button>
                          )}
                        </div>
                      ))}
                      <button type="button" onClick={() => setHouseForm({ ...houseForm, phone_numbers: [...(houseForm.phone_numbers || ['']), ''] })}
                        className="flex items-center gap-2 text-emerald-600 text-sm font-semibold hover:bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors">
                        <PlusCircle size={15} /> Add Another Number
                      </button>
                    </div>
                  </FormField>
                </div>
              </section>

              {/* Members Section */}
              <section className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="bg-purple-100 p-2 rounded-lg text-purple-600">
                      <Users size={24} />
                    </div>
                    <h2 className="text-xl font-bold">Family Members</h2>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddMember}
                    className="flex items-center gap-2 text-emerald-600 font-semibold hover:bg-emerald-50 px-4 py-2 rounded-lg transition-colors"
                  >
                    <PlusCircle size={20} />
                    Add Member
                  </button>
                </div>

                <div className="space-y-6">
                  {members.map((member, index) => (
                    <div key={index} className="p-6 bg-slate-50 rounded-xl border border-slate-200 relative group">
                      {members.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(index)}
                          className="absolute top-4 right-4 text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={20} />
                        </button>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        <FormField label="Full Name">
                          <AutocompleteInput
                            required
                            value={member.name}
                            onChange={(val) => handleMemberChange(index, 'name', val)}
                            suggestions={globalSuggestions.names || []}
                            placeholder="e.g. Rajan Pillai"
                            className="form-input"
                          />
                        </FormField>
                        <FormField label="Gender">
                          <select
                            value={member.gender}
                            onChange={(e) => handleMemberChange(index, 'gender', e.target.value)}
                            className="form-input"
                          >
                            <option>Male</option>
                            <option>Female</option>
                            <option>Other</option>
                          </select>
                        </FormField>
                        <FormField label="Age">
                          <input
                            type="number"
                            required
                            min={0}
                            value={member.age || ''}
                            onChange={(e) => handleMemberChange(index, 'age', parseInt(e.target.value) || 0)}
                            className="form-input"
                          />
                        </FormField>
                        <FormField label="Job / Education">
                          <AutocompleteInput
                            value={member.occupation}
                            onChange={(val) => {
                              const newMembers = [...members];
                              newMembers[index] = { ...newMembers[index], occupation: val, education: '' };
                              setMembers(newMembers);
                            }}
                            suggestions={Array.from(new Set([...(globalSuggestions.occupations || []), ...(globalSuggestions.educations || [])]))}
                            placeholder="e.g. Teacher, B.Ed, or Student"
                            className="form-input"
                          />
                        </FormField>

                        <FormField label="Membership Details">
                          <AutocompleteInput
                            value={member.membership_details}
                            onChange={(val) => handleMemberChange(index, 'membership_details', val)}
                            suggestions={globalSuggestions.memberships || []}
                            placeholder="e.g. Life Member"
                            className="form-input"
                          />
                        </FormField>
                        <FormField label="Blood Group">
                          <select
                            value={member.blood_group}
                            onChange={(e) => handleMemberChange(index, 'blood_group', e.target.value)}
                            className="form-input"
                          >
                            <option value="">Select</option>
                            <option>A+</option>
                            <option>A-</option>
                            <option>B+</option>
                            <option>B-</option>
                            <option>O+</option>
                            <option>O-</option>
                            <option>AB+</option>
                            <option>AB-</option>
                          </select>
                        </FormField>
                        <FormField label="Other Details" className="md:col-span-3 lg:col-span-2">
                          <AutocompleteInput
                            value={member.other_details}
                            onChange={(val) => handleMemberChange(index, 'other_details', val)}
                            suggestions={globalSuggestions.other_details || []}
                            placeholder="e.g. Ward Councillor, SNDP Branch Secretary"
                            className="form-input"
                          />
                        </FormField>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <div className="flex justify-end gap-4 pb-12">
                <button
                  type="button"
                  onClick={() => setActiveTab('dashboard')}
                  className="px-8 py-3 rounded-xl border border-slate-200 font-semibold hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-8 py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all flex items-center gap-2"
                >
                  <Save size={20} />
                  Save Survey Data
                </button>
              </div>
            </form>
          )}

          {activeTab === 'records' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 md:p-6 border-b border-slate-100 flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <h3 className="text-base md:text-lg font-semibold">All Survey Records</h3>
                    <button
                      onClick={generateAllRecordsPDF}
                      className="flex items-center gap-2 px-3 py-2 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded-lg text-xs font-bold transition-colors shrink-0"
                    >
                      <Download size={14} />
                      <span className="hidden sm:inline">Download All Records</span>
                      <span className="sm:hidden">PDF</span>
                    </button>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      placeholder="Search by name, house, area..."
                      value={houseSearch}
                      onChange={(e) => setHouseSearch(e.target.value)}
                      className="w-full pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    />
                    {houseSearch && (
                      <button onClick={() => setHouseSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  {houseSearch && (
                    <p className="text-xs text-slate-500">
                      {filteredAndSortedHouses.length} results for "{houseSearch}"
                    </p>
                  )}
                </div>
                <div className="overflow-x-auto -webkit-overflow-scrolling-touch">
                  <table className="w-full text-left min-w-[600px]">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-4 font-medium cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => { setSortBy('details'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}>House Details {sortBy === 'details' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                        <th className="px-6 py-4 font-medium cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => { setSortBy('area'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}>Area/Locality {sortBy === 'area' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                        <th className="px-6 py-4 font-medium text-center">Card</th>
                        <th className="px-6 py-4 font-medium text-center">Members</th>
                        <th className="px-6 py-4 font-medium cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => { setSortBy('date'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}>Date {sortBy === 'date' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                        <th className="px-6 py-4 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredAndSortedHouses.map((house) => {
                          const handleRowClick = async () => {
                            console.log("Opening house:", house.id);
                            try {
                              const res = await fetch(`/api/houses/${house.id}/members`);
                              const fetchedMembers = await res.json();
                              const houseWithMembers = { ...house, members: Array.isArray(fetchedMembers) ? fetchedMembers : [] };
                              setSelectedHouse(houseWithMembers);
                              setHouses(prev => prev.map(h => h.id === house.id ? houseWithMembers : h));
                            } catch (err) {
                              console.error("Error fetching members:", err);
                              setSelectedHouse({ ...house, members: [] });
                            }
                          };

                          return (
                            <tr
                              key={house.id}
                              className="hover:bg-slate-50 transition-colors cursor-pointer"
                              onClick={handleRowClick}
                            >
                            <td className="px-6 py-4">
                              <div className="font-medium text-slate-900 line-clamp-2 max-w-[300px]">{house.house_details}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-slate-700">{house.area}</div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className={cn(
                                "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                house.ration_card_type === 'APL' ? "bg-blue-100 text-blue-700" : 
                                house.ration_card_type === 'BPL' ? "bg-amber-100 text-amber-700" : 
                                house.ration_card_type === 'Other' ? "bg-slate-100 text-slate-700" :
                                "bg-slate-50 text-slate-400"
                              )}>
                                {house.ration_card_type || 'N/A'}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center justify-center gap-2 text-sm text-slate-600 font-medium">
                                <Users size={16} className="text-slate-400" />
                                {house.members?.length || 0}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-slate-500 text-sm">
                              {new Date(house.created_at || '').toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => generateHousePDF(house)}
                                  className="p-2 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-emerald-50"
                                  title="Download PDF"
                                >
                                  <FileText size={18} />
                                </button>
                                <button
                                  onClick={handleRowClick}
                                  className="p-2 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50"
                                  title="View Details"
                                >
                                  <Users size={18} />
                                </button>
                                <button
                                  onClick={() => handleDeleteHouse(house.id!)}
                                  className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {houses.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-slate-400">No records found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="max-w-md mx-auto">
              <section className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3 mb-8">
                  <div className="bg-slate-100 p-2 rounded-lg text-slate-600">
                    <Users size={24} />
                  </div>
                  <h2 className="text-xl font-bold">Change Password</h2>
                </div>
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <FormField label="Current Password">
                    <div className="relative">
                      <input
                        type={showOldPwd ? "text" : "password"}
                        required
                        value={pwdForm.oldPassword}
                        onChange={(e) => setPwdForm({ ...pwdForm, oldPassword: e.target.value })}
                        className="form-input pr-12"
                      />
                      <button
                        type="button"
                        onClick={() => setShowOldPwd(!showOldPwd)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {showOldPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </FormField>
                  <FormField label="New Password">
                    <div className="relative">
                      <input
                        type={showNewPwd ? "text" : "password"}
                        required
                        value={pwdForm.newPassword}
                        onChange={(e) => setPwdForm({ ...pwdForm, newPassword: e.target.value })}
                        className="form-input pr-12"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPwd(!showNewPwd)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {showNewPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </FormField>
                  <FormField label="Confirm New Password">
                    <div className="relative">
                      <input
                        type={showConfirmPwd ? "text" : "password"}
                        required
                        value={pwdForm.confirmPassword}
                        onChange={(e) => setPwdForm({ ...pwdForm, confirmPassword: e.target.value })}
                        className="form-input pr-12"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {showConfirmPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </FormField>
                  <button
                    type="submit"
                    className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all mt-4"
                  >
                    Update Password
                  </button>
                </form>
              </section>

              <section className="bg-white p-8 rounded-2xl border border-red-100 shadow-sm mt-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="bg-red-100 p-2 rounded-lg text-red-600">
                    <Trash2 size={24} />
                  </div>
                  <h2 className="text-xl font-bold text-red-600">Danger Zone</h2>
                </div>
                <p className="text-slate-500 text-sm mb-6">
                  To clear all survey records, please enter your current admin password below.
                </p>
                <div className="space-y-4">
                  <FormField label="Enter Admin Password to Confirm">
                    <input
                      type="password"
                      value={clearPassword}
                      onChange={(e) => setClearPassword(e.target.value)}
                      className="form-input border-red-200 focus:border-red-500 focus:ring-red-500"
                      placeholder="Type password here..."
                    />
                  </FormField>
                  <button
                    onClick={handleClearData}
                    className="w-full py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200"
                  >
                    Permanently Clear All Data
                  </button>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'import' && (
            <ImportPanel onImportSuccess={() => { fetchStats(); fetchHouses(); }} />
          )}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      {!isDesktop && (
        <nav className="fixed bottom-0 inset-x-0 z-40 bg-slate-900 border-t border-slate-800 flex items-center justify-around px-2 py-1 safe-area-bottom">
          {[
            { tab: 'dashboard' as Tab, icon: <LayoutDashboard size={20} />, label: 'Home' },
            { tab: 'survey' as Tab, icon: <PlusCircle size={20} />, label: 'Survey' },
            { tab: 'records' as Tab, icon: <Home size={20} />, label: 'Records' },
            { tab: 'settings' as Tab, icon: <Users size={20} />, label: 'Settings' },
          ].map(({ tab, icon, label }) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all duration-200',
                activeTab === tab
                  ? 'text-emerald-400'
                  : 'text-slate-500 hover:text-slate-300'
              )}
            >
              {icon}
              <span className="text-[10px] font-semibold">{label}</span>
            </button>
          ))}
          <button
            onClick={() => setUser(null)}
            className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-slate-500 hover:text-red-400 transition-colors"
          >
            <LogOut size={20} />
            <span className="text-[10px] font-semibold">Logout</span>
          </button>
        </nav>
      )}

      {/* Confirmation Modal */}
      {
        confirmModal?.open && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={() => setConfirmModal(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 flex flex-col gap-6 animate-scale-in" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start gap-4">
                <div className="bg-red-100 p-3 rounded-xl shrink-0">
                  <Trash2 className="text-red-600" size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-1">Confirm Action</h3>
                  <p className="text-slate-600 text-sm leading-relaxed">{confirmModal.message}</p>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setConfirmModal(null)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    confirmModal.onConfirm();
                    setConfirmModal(null);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
                >
                  Yes, Confirm
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* House Details Modal */}
      {selectedHouse && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-end sm:items-center justify-center sm:p-4 overflow-hidden" onClick={() => setSelectedHouse(null)}>
          <div className="bg-white rounded-t-[2rem] sm:rounded-[2.5rem] shadow-[0_35px_60px_-15px_rgba(0,0,0,0.3)] w-full max-w-5xl max-h-[92vh] sm:max-h-[90vh] overflow-hidden flex flex-col animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="p-4 sm:p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900">House Details</h3>
                <p className="text-sm text-slate-500">{selectedHouse.area}</p>
              </div>
              <button
                onClick={() => { setSelectedHouse(null); setEditingMemberId(null); }}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                title="Close Modal"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-4 sm:p-8 flex-1 overflow-y-auto space-y-6 sm:space-y-8">
              <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 relative group">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="text-sm font-bold text-emerald-700 uppercase tracking-wider">Address & Details</h4>
                  <button
                    onClick={() => setIsEditingHouse(!isEditingHouse)}
                    className="text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-emerald-100 rounded"
                  >
                    <Edit size={16} />
                  </button>
                </div>

                {isEditingHouse ? (
                  <div className="space-y-4">
                    <textarea
                      className="form-input bg-white"
                      value={selectedHouse.house_details}
                      onChange={(e) => setSelectedHouse({ ...selectedHouse, house_details: e.target.value })}
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <input
                        type="text"
                        className="form-input bg-white"
                        value={selectedHouse.area}
                        onChange={(e) => setSelectedHouse({ ...selectedHouse, area: e.target.value })}
                        placeholder="Area"
                      />
                      <select
                        className="form-input bg-white"
                        value={selectedHouse.ration_card_type}
                        onChange={(e) => setSelectedHouse({ ...selectedHouse, ration_card_type: e.target.value })}
                      >
                        <option value="">Select Ration Card</option>
                        <option>APL</option>
                        <option>BPL</option>
                        <option>Other</option>
                      </select>
                    </div>
                    {/* Phone Numbers Edit */}
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700 flex items-center gap-1"><Phone size={14} /> House Phone Number(s)</label>
                      {(selectedHouse.phone_numbers || ['']).map((ph, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <input type="tel" value={ph}
                            onChange={(e) => {
                              const next = [...(selectedHouse.phone_numbers || [''])];
                              next[idx] = e.target.value;
                              setSelectedHouse({ ...selectedHouse, phone_numbers: next });
                            }}
                            className="form-input bg-white flex-1" placeholder={`Phone ${idx + 1}`}
                          />
                          {(selectedHouse.phone_numbers || []).length > 1 && (
                            <button type="button" onClick={() => {
                              const next = (selectedHouse.phone_numbers || []).filter((_, i) => i !== idx);
                              setSelectedHouse({ ...selectedHouse, phone_numbers: next });
                            }} className="p-2 text-red-400 hover:text-red-600 rounded-lg"><X size={14} /></button>
                          )}
                        </div>
                      ))}
                      <button type="button"
                        onClick={() => setSelectedHouse({ ...selectedHouse, phone_numbers: [...(selectedHouse.phone_numbers || ['']), ''] })}
                        className="flex items-center gap-1 text-emerald-600 text-sm font-semibold hover:bg-emerald-50 px-3 py-1 rounded-lg">
                        <PlusCircle size={14} /> Add Number
                      </button>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setIsEditingHouse(false)}
                        className="px-3 py-1 text-sm font-medium text-slate-600 hover:bg-emerald-100 rounded"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            const res = await fetch(`/api/houses/${selectedHouse.id}`, {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ house_details: selectedHouse.house_details, area: selectedHouse.area, ration_card_type: selectedHouse.ration_card_type, phone_numbers: selectedHouse.phone_numbers || [] })
                            });
                            if (res.ok) {
                              setIsEditingHouse(false);
                              fetchHouses();
                            }
                          } catch (err) {
                            alert('Failed to update house');
                          }
                        }}
                        className="px-3 py-1 text-sm font-medium bg-emerald-600 text-white rounded hover:bg-emerald-700"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-slate-800 whitespace-pre-wrap mb-3">{selectedHouse.house_details}</p>
                    {selectedHouse.phone_numbers && selectedHouse.phone_numbers.filter(Boolean).length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {selectedHouse.phone_numbers.filter(Boolean).map((ph, i) => (
                          <a key={i} href={`tel:${ph}`} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-100 transition-colors">
                            <Phone size={13} /> {ph}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Users size={20} className="text-emerald-500" />
                    Family Members ({Array.isArray(selectedHouse.members) ? selectedHouse.members.length : 0})
                  </h4>
                  <button
                    onClick={() => {
                      setEditingMemberId(-1);
                      setMemberEditForm({
                        name: '', gender: 'Male', age: 0, occupation: '', education: '',
                        membership_details: '', blood_group: '', phone: '', other_details: ''
                      } as unknown as Member);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 text-sm font-bold rounded-lg transition-colors"
                  >
                    <PlusCircle size={16} />
                    Add Member
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Add New Member Form */}
                  {editingMemberId === -1 && memberEditForm && (
                    <div className="p-6 bg-emerald-50 rounded-2xl border-2 border-emerald-300 border-dashed shadow-sm">
                      <p className="text-sm font-bold text-emerald-700 mb-4 flex items-center gap-2"><PlusCircle size={16}/>New Member</p>
                      <form onSubmit={handleUpdateMember} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <FormField label="Name">
                            <AutocompleteInput
                              value={memberEditForm.name || ''}
                              onChange={(val) => setMemberEditForm(prev => ({ ...prev!, name: val }))}
                              suggestions={globalSuggestions.names || []}
                              className="form-input"
                              placeholder="Member Name"
                              required
                            />
                          </FormField>
                          <FormField label="Age">
                            <input type="number" className="form-input" min={0} required
                              value={memberEditForm.age || ''}
                              onChange={(e) => setMemberEditForm(prev => ({ ...prev!, age: parseInt(e.target.value) || 0 }))}
                            />
                          </FormField>
                          <FormField label="Gender">
                            <select className="form-input" value={memberEditForm.gender}
                              onChange={(e) => setMemberEditForm(prev => ({ ...prev!, gender: e.target.value }))}
                            >
                              <option>Male</option><option>Female</option><option>Other</option>
                            </select>
                          </FormField>
                          <FormField label="Job / Education">
                            <AutocompleteInput
                              value={memberEditForm.occupation || ''}
                              onChange={(val) => setMemberEditForm(prev => ({ ...prev!, occupation: val, education: '' }))}
                              suggestions={Array.from(new Set([...(globalSuggestions.occupations || []), ...(globalSuggestions.educations || [])]))}
                              placeholder="e.g. Teacher, B.Ed, or Student"
                              className="form-input"
                            />
                          </FormField>
                          <FormField label="Membership">
                            <AutocompleteInput
                              value={memberEditForm.membership_details || ''}
                              onChange={(val) => setMemberEditForm(prev => ({ ...prev!, membership_details: val }))}
                              suggestions={globalSuggestions.memberships || []}
                              placeholder="e.g. Life Member"
                              className="form-input"
                            />
                          </FormField>
                          <FormField label="Blood Group">
                            <select className="form-input" value={memberEditForm.blood_group || ''}
                              onChange={(e) => setMemberEditForm(prev => ({ ...prev!, blood_group: e.target.value }))}
                            >
                              <option value="">Select</option>
                              <option>A+</option><option>A-</option><option>B+</option><option>B-</option>
                              <option>O+</option><option>O-</option><option>AB+</option><option>AB-</option>
                            </select>
                          </FormField>
                          <FormField label="Other Details" className="md:col-span-3">
                            <AutocompleteInput
                              value={memberEditForm.other_details || ''}
                              onChange={(val) => setMemberEditForm(prev => ({ ...prev!, other_details: val }))}
                              suggestions={globalSuggestions.other_details || []}
                              placeholder="e.g. Ward Councillor"
                              className="form-input"
                            />
                          </FormField>
                        </div>
                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={() => { setEditingMemberId(null); setMemberEditForm(null); }} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg">Cancel</button>
                          <button type="submit" className="px-4 py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 flex items-center gap-2"><PlusCircle size={15}/>Add Member</button>
                        </div>
                      </form>
                    </div>
                  )}
                  {/* Existing Members */}
                  {(Array.isArray(selectedHouse.members) ? selectedHouse.members : []).map((member) => (
                    <div key={member.id} className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-emerald-200 transition-all">
                      {editingMemberId === member.id ? (
                        <form onSubmit={handleUpdateMember} className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <FormField label="Name">
                              <AutocompleteInput
                                value={memberEditForm?.name || ''}
                                onChange={(val) => setMemberEditForm({ ...memberEditForm!, name: val })}
                                suggestions={globalSuggestions.names || []}
                                className="form-input"
                                placeholder="Member Name"
                              />
                            </FormField>
                            <FormField label="Age">
                              <input
                                type="number"
                                className="form-input"
                                min={0}
                                value={memberEditForm?.age || ''}
                                onChange={(e) => setMemberEditForm({ ...memberEditForm!, age: parseInt(e.target.value) || 0 })}
                              />
                            </FormField>
                            <FormField label="Gender">
                              <select
                                className="form-input"
                                value={memberEditForm?.gender}
                                onChange={(e) => setMemberEditForm({ ...memberEditForm!, gender: e.target.value })}
                              >
                                <option>Male</option>
                                <option>Female</option>
                                <option>Other</option>
                              </select>
                            </FormField>
                            <FormField label="Job / Education">
                              <AutocompleteInput
                                value={memberEditForm?.occupation || ''}
                                onChange={(val) => {
                                  setMemberEditForm({ ...memberEditForm!, occupation: val, education: '' });
                                }}
                                suggestions={Array.from(new Set([...(globalSuggestions.occupations || []), ...(globalSuggestions.educations || [])]))}
                                placeholder="e.g. Teacher, B.Ed, or Student"
                                className="form-input"
                              />
                            </FormField>

                            <FormField label="Membership">
                              <AutocompleteInput
                                value={memberEditForm?.membership_details || ''}
                                onChange={(val) => setMemberEditForm({ ...memberEditForm!, membership_details: val })}
                                suggestions={globalSuggestions.memberships || []}
                                placeholder="e.g. Life Member"
                                className="form-input"
                              />
                            </FormField>
                            <FormField label="Blood Group">
                              <select
                                className="form-input"
                                value={memberEditForm?.blood_group}
                                onChange={(e) => setMemberEditForm({ ...memberEditForm!, blood_group: e.target.value })}
                              >
                                <option value="">Select</option>
                                <option>A+</option>
                                <option>A-</option>
                                <option>B+</option>
                                <option>B-</option>
                                <option>O+</option>
                                <option>O-</option>
                                <option>AB+</option>
                                <option>AB-</option>
                              </select>
                            </FormField>
                            <FormField label="Other Details" className="md:col-span-3">
                              <AutocompleteInput
                                value={memberEditForm?.other_details || ''}
                                onChange={(val) => setMemberEditForm({ ...memberEditForm!, other_details: val })}
                                suggestions={globalSuggestions.other_details || []}
                                placeholder="e.g. Ward Councillor"
                                className="form-input"
                              />
                            </FormField>
                          </div>
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingMemberId(null)}
                              className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              className="px-4 py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700"
                            >
                              Save Changes
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-8 gap-y-6 flex-1 w-full">
                            <div>
                              <div className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">Name</div>
                              <div className="font-bold text-slate-900 text-lg">{member.name}</div>
                            </div>
                            <div>
                              <div className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">Age / Gender</div>
                              <div className="text-slate-700 font-medium">{member.age} yrs • {member.gender}</div>
                            </div>
                            <div>
                              <div className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">Blood Group</div>
                              <div className="text-slate-700 font-medium">{member.blood_group || 'Not Specified'}</div>
                            </div>
                            <div>
                              <div className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">Contact</div>
                              <div className="text-slate-700 font-medium">{member.phone || 'No Number'}</div>
                            </div>
                            <div className="sm:col-span-2">
                              <div className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">Job / Education</div>
                              <div className="text-slate-700 font-medium">{member.occupation || member.education || 'Not Specified'}</div>
                            </div>
                            <div>
                              <div className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">Ration Card</div>
                              <div className="text-slate-700 font-medium">{selectedHouse.ration_card_type || 'Not Specified'}</div>
                            </div>
                            <div>
                              <div className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">Membership</div>
                              <div className="text-slate-700 font-medium">{member.membership_details || 'Not Specified'}</div>
                            </div>
                            <div className="sm:col-span-2 lg:col-span-4">
                              <div className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">Notes / Other Details</div>
                              <div className="text-slate-700 font-medium bg-slate-50 p-2 rounded border border-slate-100">{member.other_details || 'No notes added'}</div>
                            </div>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <button
                              onClick={() => { setEditingMemberId(member.id!); setMemberEditForm(member); }}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit Member"
                            >
                              <Edit size={18} />
                            </button>
                            <button
                              onClick={() => handleDeleteMember(member.id!)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete Member"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Import Panel Component ----
function ImportPanel({ onImportSuccess }: { onImportSuccess: () => void }) {
  const [status, setStatus] = useState<'idle' | 'parsing' | 'preview' | 'importing' | 'done'>('idle');
  const [records, setRecords] = useState<any[]>([]);
  const [result, setResult] = useState<{ imported: number; errors: string[]; total: number } | null>(null);
  const [error, setError] = useState('');
  const fileRef = React.useRef<HTMLInputElement>(null);

  const parseFile = async (file: File) => {
    setStatus('parsing');
    setError('');
    const ext = file.name.split('.').pop()?.toLowerCase();
    try {
      if (ext === 'json') {
        const text = await file.text();
        const data = JSON.parse(text);
        setRecords(Array.isArray(data) ? data : [data]);
        setStatus('preview');
      } else if (ext === 'csv') {
        const text = await file.text();
        const lines = text.split('\n').filter(l => l.trim());
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        const rows = lines.slice(1).map(line => {
          const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
          const obj: any = {};
          headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
          return obj;
        });
        setRecords(rows);
        setStatus('preview');
      } else if (ext === 'pdf') {
        const buffer = await file.arrayBuffer();
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
        const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
        // Extract all text items with position info
        const allItems: { str: string; x: number; y: number; page: number }[] = [];
        for (let p = 1; p <= pdf.numPages; p++) {
          const page = await pdf.getPage(p);
          const vp = page.getViewport({ scale: 1 });
          const tc = await page.getTextContent();
          for (const item of tc.items as any[]) {
            if (item.str?.trim()) {
              allItems.push({
                str: item.str.trim(),
                x: Math.round(item.transform[4]),
                y: Math.round(vp.height - item.transform[5]),
                page: p,
              });
            }
          }
        }
        // Sort: page → y (top-to-bottom) → x (left-to-right)
        allItems.sort((a, b) => a.page !== b.page ? a.page - b.page : Math.abs(a.y - b.y) > 4 ? a.y - b.y : a.x - b.x);
        // Group into rows by Y proximity (within 5 units = same row)
        const pdfRows: string[][] = [];
        let rowBuf: typeof allItems = [];
        for (const item of allItems) {
          if (rowBuf.length === 0 || (item.page === rowBuf[0].page && Math.abs(item.y - rowBuf[0].y) <= 5)) {
            rowBuf.push(item);
          } else {
            pdfRows.push(rowBuf.sort((a, b) => a.x - b.x).map(i => i.str));
            rowBuf = [item];
          }
        }
        if (rowBuf.length) pdfRows.push(rowBuf.sort((a, b) => a.x - b.x).map(i => i.str));
        // Parse house records from rows
        const parsed: any[] = [];
        let house: any = null;
        let readingMembers = false;
        for (const row of pdfRows) {
          const line = row.join(' ');
          const houseMatch = line.match(/HOUSE:\s*(.+)/i);
          if (houseMatch) {
            if (house) parsed.push(house);
            house = { house_details: houseMatch[1].trim(), area: '', members: [] };
            readingMembers = false;
          } else if (house && /^name$/i.test(row[0]) && row.some(r => /^gen$/i.test(r))) {
            readingMembers = true;
          } else if (house && readingMembers && row.length >= 3 && !/^(official|page|sndp|report)/i.test(row[0])) {
            const [name, gen, age, jobEdu = '', membership = '', blood = '', phone = '', ...rest] = row;
            if (name && name.length > 1 && !/^\d+$/.test(name)) {
              house.members.push({
                name,
                gender: gen === 'M' ? 'Male' : gen === 'F' ? 'Female' : 'Male',
                age: parseInt(age) || 0,
                occupation: jobEdu !== '-' ? jobEdu : '',
                education: '',
                membership_details: membership !== '-' ? membership : '',
                blood_group: blood !== '-' ? blood : '',
                phone: phone !== '-' ? phone : '',
                other_details: rest.join(' ') !== '-' ? rest.join(' ') : '',
              });
            }
          }
        }
        if (house) parsed.push(house);
        if (parsed.length === 0) {
          setError('No house records found in this PDF. Make sure it was exported using "Download All Records" from this app.');
          setStatus('idle');
        } else {
          setRecords(parsed);
          setStatus('preview');
        }
      } else if (ext === 'xlsx' || ext === 'xls') {
        setError('For Excel files (.xlsx/.xls), please first export the file as CSV from Excel (File → Save As → CSV), then upload that CSV here.');
        setStatus('idle');
      } else {
        setError('Unsupported file. Please upload a .json, .csv, or .pdf file.');
        setStatus('idle');
      }
    } catch (e: any) {
      setError('Failed to parse file: ' + e.message);
      setStatus('idle');
    }
  };

  const handleImport = async () => {
    setStatus('importing');
    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records })
      });
      const data = await res.json();
      setResult(data);
      setStatus('done');
      onImportSuccess();
    } catch (e: any) {
      setError('Import failed: ' + e.message);
      setStatus('preview');
    }
  };

  const reset = () => {
    setStatus('idle');
    setRecords([]);
    setResult(null);
    setError('');
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="space-y-6">
      <section className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600"><Upload size={24} /></div>
          <div>
            <h2 className="text-xl font-bold">Import Survey Data</h2>
            <p className="text-sm text-slate-500">Restore lost data by uploading a JSON or CSV file</p>
          </div>
        </div>

        {status === 'done' && result ? (
          <div className="space-y-4">
            <div className={cn("p-6 rounded-2xl border-2", result.errors.length === 0 ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200")}>
              <h3 className="font-bold text-lg text-slate-900 mb-2">Import Complete!</h3>
              <p className="text-slate-700">✅ Successfully imported <strong>{result.imported}</strong> of <strong>{result.total}</strong> records.</p>
              {result.errors.length > 0 && (
                <div className="mt-4">
                  <p className="text-amber-700 font-semibold text-sm mb-2">⚠️ {result.errors.length} row(s) had errors:</p>
                  <ul className="space-y-1 max-h-32 overflow-y-auto">
                    {result.errors.map((e, i) => <li key={i} className="text-xs text-red-600 bg-red-50 px-3 py-1 rounded">{e}</li>)}
                  </ul>
                </div>
              )}
            </div>
            <button onClick={reset} className="px-6 py-2.5 bg-slate-900 text-white font-semibold rounded-xl hover:bg-slate-800 transition-colors">
              Import Another File
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* File Drop Zone */}
            <label className={cn(
              "flex flex-col items-center justify-center gap-4 p-12 border-2 border-dashed rounded-2xl cursor-pointer transition-all",
              status === 'parsing' ? "border-indigo-300 bg-indigo-50" : "border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50"
            )}>
              <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-500">
                <Upload size={32} />
              </div>
              <div className="text-center">
                <p className="font-bold text-slate-800 text-lg">Drop file here or click to browse</p>
                <p className="text-slate-500 text-sm mt-1">Supports <strong>.json</strong>, <strong>.csv</strong> and <strong>.pdf</strong> (app export) files</p>
              </div>
              <input ref={fileRef} type="file" accept=".json,.csv,.xlsx,.xls,.pdf" className="hidden"
                onChange={e => { if (e.target.files?.[0]) parseFile(e.target.files[0]); }}
              />
            </label>

            {error && (
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            {/* Expected Format Guide */}
            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
              <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><FileText size={16} />Expected File Format (JSON)</h3>
              <pre className="text-xs text-slate-600 overflow-x-auto bg-white p-4 rounded-xl border border-slate-200">{`[
  {
    "house_details": "House Name, Address",
    "area": "Locality / Ward",
    "ration_card_type": "APL",
    "phone_numbers": ["9446123456", "9876543210"],
    "members": [
      {
        "name": "Name",
        "gender": "Male",
        "age": 45,
        "occupation": "Teacher",
        "blood_group": "B+",
        "membership_details": "Life Member"
      }
    ]
  }
]`}</pre>
              <p className="text-xs text-slate-500 mt-3">💡 For CSV, each row should be one house. For full member details, use <strong>JSON</strong>. To restore from a printed backup, upload the <strong>PDF</strong> generated by "Download All Records".</p>
            </div>

            {/* Preview */}
            {status === 'preview' && records.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-800">{records.length} record(s) ready to import</h3>
                  <button onClick={reset} className="text-sm text-slate-500 hover:text-red-500 font-medium">Clear</button>
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">#</th>
                        <th className="px-4 py-3 text-left font-medium">House Details</th>
                        <th className="px-4 py-3 text-left font-medium">Area</th>
                        <th className="px-4 py-3 text-left font-medium">Ration Card</th>
                        <th className="px-4 py-3 text-left font-medium">Members</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {records.slice(0, 10).map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-slate-400">{i + 1}</td>
                          <td className="px-4 py-3 font-medium text-slate-900 max-w-[200px] truncate">{r.house_details || r.address || '—'}</td>
                          <td className="px-4 py-3 text-slate-600">{r.area || '—'}</td>
                          <td className="px-4 py-3"><span className="px-2 py-0.5 bg-slate-100 rounded text-xs font-medium">{r.ration_card_type || '—'}</span></td>
                          <td className="px-4 py-3 text-slate-600">{Array.isArray(r.members) ? r.members.length : 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {records.length > 10 && (
                    <p className="text-xs text-slate-500 text-center py-3">...and {records.length - 10} more records</p>
                  )}
                </div>
                <div className="flex gap-3">
                  <button onClick={reset} className="px-6 py-3 border border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-colors">
                    Cancel
                  </button>
                  <button onClick={handleImport}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">
                    <><Upload size={18} />Import {records.length} Records</>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function SidebarItem({ icon, label, active, collapsed, onClick }: {
  icon: React.ReactNode,
  label: string,
  active?: boolean,
  collapsed?: boolean,
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
        active
          ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/20"
          : "text-slate-400 hover:bg-slate-800 hover:text-white"
      )}
    >
      {icon}
      {!collapsed && <span className="font-medium">{label}</span>}
    </button>
  );
}

function StatCard({ title, value, icon, color, trend }: {
  title: string,
  value: string | number,
  icon: React.ReactNode,
  color?: string,
  trend?: string
}) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600",
    emerald: "bg-emerald-50 text-emerald-600",
    rose: "bg-rose-50 text-rose-600",
    sky: "bg-sky-50 text-sky-600",
    amber: "bg-amber-50 text-amber-600",
    indigo: "bg-indigo-50 text-indigo-600",
    teal: "bg-teal-50 text-teal-600",
    slate: "bg-slate-50 text-slate-600"
  };

  return (
    <div className="group bg-white p-7 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-24 h-24 bg-slate-50 rounded-full translate-x-8 -translate-y-8 group-hover:bg-emerald-50/50 transition-colors"></div>
      
      <div className="relative z-10">
        <div className={cn("p-4 rounded-2xl w-fit mb-6 shadow-sm", color ? colorMap[color] : "bg-slate-50")}>
          {icon}
        </div>
        
        <p className="text-slate-500 text-xs font-black uppercase tracking-widest mb-2">{title}</p>
        <div className="flex items-baseline gap-2">
          <h4 className="text-3xl font-black text-slate-900 tracking-tight">{value}</h4>
          {trend && (
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">
              {trend}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function FormField({ label, children, className, required }: {
  label: string,
  children: React.ReactNode,
  className?: string,
  required?: boolean
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <label className="text-sm font-semibold text-slate-700 flex items-center gap-1">
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}
