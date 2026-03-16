import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Home,
  Users,
  PlusCircle,
  Search,
  ChevronRight,
  Save,
  Trash2,
  TrendingUp,
  MapPin,
  Phone,
  Briefcase,
  GraduationCap,
  Menu,
  X,
  FileText,
  Download,
  Edit
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Tab = 'dashboard' | 'survey' | 'records' | 'settings';

interface User {
  id: number;
  username: string;
}

interface House {
  id?: number;
  house_details: string;
  area: string;
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
  ration_card_type: string;
  membership_details: string;
  blood_group: string;
  phone: string;
  other_details: string;
}



interface Stats {
  totalHouses: number;
  totalMembers: number;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [stats, setStats] = useState<Stats>({
    totalHouses: 0,
    totalMembers: 0
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

  // Derived unique values for Autocomplete Suggestions
  const uniqueAreas = React.useMemo(() => {
    const areas = houses.map(h => h.area).filter(Boolean);
    return Array.from(new Set(areas)).sort();
  }, [houses]);

  const uniqueJobs = React.useMemo(() => {
    const jobs: string[] = [];
    houses.forEach(h => {
      h.members?.forEach(m => {
        if (m.occupation) jobs.push(m.occupation);
        if (m.education) jobs.push(m.education);
      });
    });
    return Array.from(new Set(jobs)).filter(Boolean).sort();
  }, [houses]);

  const uniqueMemberships = React.useMemo(() => {
    const memberships: string[] = [];
    houses.forEach(h => {
      h.members?.forEach(m => {
        if (m.membership_details) memberships.push(m.membership_details);
      });
    });
    return Array.from(new Set(memberships)).filter(Boolean).sort();
  }, [houses]);

  // Password Change State
  const [pwdForm, setPwdForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [clearPassword, setClearPassword] = useState('');



  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{ open: boolean; message: string; onConfirm: () => void } | null>(null);

  const showConfirm = (message: string, onConfirm: () => void) => {
    setConfirmModal({ open: true, message, onConfirm });
  };

  // Form State
  const [houseForm, setHouseForm] = useState<House>({
    house_details: '',
    area: ''
  });
  const [members, setMembers] = useState<Member[]>([{
    name: '',
    gender: 'Male',
    age: 0,
    occupation: '',
    education: '',
    ration_card_type: '',
    membership_details: '',
    blood_group: '',
    phone: '',
    other_details: ''
  }]);

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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
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
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert('Login failed');
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
      setHouses(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddMember = () => {
    setMembers([{
      name: '',
      gender: 'Male',
      age: 0,
      occupation: '',
      education: '',
      ration_card_type: '',
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
        setHouseForm({ house_details: '', area: '' });
        setMembers([{
          name: '',
          gender: 'Male',
          age: 0,
          occupation: '',
          education: '',
          ration_card_type: '',
          membership_details: '',
          blood_group: '',
          phone: '',
          other_details: ''
        }]);
        fetchStats();
        fetchHouses();
        setActiveTab('dashboard');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to save data');
    }
  };



  const generateHousePDF = (house: House) => {
    const doc = new jsPDF();

    // Header
    doc.setFontSize(18);
    doc.setTextColor(30, 41, 59); // Slate 800
    doc.text('SNDP SHAKHA 1176 PIRAPPANCODE - FAMILY SURVEY', 105, 20, { align: 'center' });

    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(`House Details: ${house.house_details}`, 20, 40);
    doc.text(`Area/Locality: ${house.area}`, 20, 50);
    doc.text(`Date: ${new Date(house.created_at || '').toLocaleDateString()}`, 20, 60);

    // Members Table
    const tableColumn = ["Name", "Gender", "Age", "Job / Education", "Ration Card", "Membership", "Blood", "Phone", "Other"];
    const tableRows = house.members?.map(m => [
      m.name,
      m.gender,
      m.age,
      m.occupation || m.education || '-',
      m.ration_card_type,
      m.membership_details,
      m.blood_group,
      m.phone,
      m.other_details
    ]);

    autoTable(doc, {
      startY: 70,
      head: [tableColumn],
      body: tableRows,
      headStyles: { fillColor: [30, 41, 59] },
      styles: { fontSize: 7 }
    });

    doc.save(`${house.house_details.slice(0, 20)}_report.pdf`);
  };

  const generateAllRecordsPDF = () => {
    const doc = new jsPDF('p', 'mm', 'a4');

    doc.setFontSize(18);
    doc.setTextColor(30, 41, 59);
    doc.text('SNDP SHAKHA 1176 PIRAPPANCODE - FAMILY SURVEY', 105, 20, { align: 'center' });

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 105, 30, { align: 'center' });

    let currentY = 40;

    houses.forEach((h, index) => {
      // Check if we need a new page based on currentY
      if (currentY > 250) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFontSize(16);
      doc.setTextColor(30, 41, 59);
      doc.setFont('helvetica', 'bold');
      doc.text(`House ${index + 1}: ${h.house_details}`, 14, currentY);

      currentY += 8;
      doc.setFontSize(12);
      doc.setTextColor(0);
      doc.setFont('helvetica', 'normal');
      doc.text(`Area/Locality: ${h.area}`, 14, currentY);

      currentY += 10;

      const tableColumn = ["Name", "Gender", "Age", "Job / Education", "Ration Card", "Membership", "Blood", "Phone"];
      const tableRows = h.members?.map(m => [
        m.name,
        m.gender,
        m.age,
        m.occupation || m.education || '-',
        m.ration_card_type,
        m.membership_details,
        m.blood_group,
        m.phone
      ]) || [];

      autoTable(doc, {
        startY: currentY,
        head: [tableColumn],
        body: tableRows,
        headStyles: { fillColor: [30, 41, 59] },
        styles: { fontSize: 8 },
        margin: { left: 14, right: 14 },
      });

      currentY = (doc as any).lastAutoTable.finalY + 15;
    });

    doc.save('sndp_master_survey_records.pdf');
  };

  const handleDownloadProject = () => {
    window.location.href = '/api/download-project';
  };

  const handleClearData = async () => {
    if (!clearPassword) {
      alert('Please enter your admin password to clear data.');
      return;
    }

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

  const handleSeedData = () => {
    // Disabled as requested
    alert('Sample data loading is disabled.');
  };



  const generateDashboardPDF = () => {
    try {
      const doc = new jsPDF();

      doc.setFontSize(18);
      doc.setTextColor(30, 41, 59);
      doc.text('SNDP SHAKHA 1176 PIRAPPANCODE - FAMILY SURVEY', 105, 20, { align: 'center' });

      doc.setFontSize(12);
      doc.setTextColor(0);
      doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 35);

      doc.setFontSize(16);
      doc.text('Key Statistics', 20, 50);

      doc.setFontSize(12);
      doc.text(`Total Houses: ${stats.totalHouses}`, 20, 65);
      doc.text(`Total Members: ${stats.totalMembers}`, 20, 75);

      doc.setFontSize(16);


      doc.save('sndp_dashboard_summary.pdf');
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
    if (!memberEditForm || !editingMemberId) return;
    try {
      const res = await fetch(`/api/members/${editingMemberId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(memberEditForm)
      });
      if (res.ok) {
        alert('Member updated!');
        setEditingMemberId(null);
        setMemberEditForm(null);
        fetchHouses();
        // Update selected house state to reflect changes
        const updatedHouses = await (await fetch('/api/houses')).json();
        setHouses(updatedHouses);
        if (selectedHouse) {
          const updated = updatedHouses.find((h: any) => h.id === selectedHouse.id);
          setSelectedHouse(updated);
        }
      }
    } catch (err) {
      console.error(err);
      alert('Failed to update member');
    }
  };

  const handleDeleteMember = (id: number) => {
    showConfirm('Are you sure you want to delete this member? This action cannot be undone.', async () => {
      try {
        const res = await fetch(`/api/members/${id}`, { method: 'DELETE' });
        if (res.ok) {
          await fetchStats();
          const housesRes = await fetch('/api/houses');
          const updatedHouses = await housesRes.json();
          setHouses(updatedHouses);
        }
      } catch (err) {
        console.error('Delete member error:', err);
        alert('Failed to delete member');
      }
    });
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl">
          <div className="flex flex-col items-center mb-8">
            <div className="bg-emerald-500 p-4 rounded-2xl mb-4 shadow-lg shadow-emerald-200">
              <LayoutDashboard size={32} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">SNDP Survey Dashboard</h1>
            <p className="text-slate-500 text-sm mt-2">Shakha 1176 Pirappancode</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <input
                type="text"
                required
                value={loginForm.username}
                onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                className="form-input"
                placeholder="Username"
              />
            </div>
            <div className="space-y-2">
              <input
                type="password"
                required
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                className="form-input"
                placeholder="Password"
              />
            </div>
            <button
              type="submit"
              className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 mt-4"
            >
              Sign In
            </button>
          </form>
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
        isDesktop ? (isSidebarOpen ? "w-64" : "w-20") : (isSidebarOpen ? "fixed inset-y-0 left-0 w-64" : "fixed inset-y-0 -left-64 w-64")
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
        </nav>

        <button
          onClick={() => setUser(null)}
          className="p-4 hover:bg-red-900/20 text-red-400 border-t border-slate-800 flex items-center gap-3"
        >
          <X size={20} />
          {(isSidebarOpen || !isDesktop) && <span className="font-medium">Logout</span>}
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto w-full">
        <header className="bg-white border-b border-slate-200 p-4 md:p-6 flex justify-between items-center sticky top-0 z-10">
          <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 flex-1">
            <div className="flex items-center gap-2">
              {!isDesktop && (
                <button onClick={() => setIsSidebarOpen(true)} className="p-2 hover:bg-slate-100 rounded-lg shrink-0">
                  <Menu size={24} />
                </button>
              )}
              <h1 className="text-sm md:text-xl font-extrabold uppercase bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-500 bg-clip-text text-transparent truncate line-clamp-1 break-all">
                SNDP SHAKHA 1176 PIRAPPANCODE - FAMILY SURVEY
              </h1>
            </div>
            {activeTab !== 'dashboard' && (
              <span className="hidden md:inline px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-sm font-bold shadow-sm whitespace-nowrap">
                {activeTab === 'survey' ? 'Data Entry' : activeTab === 'records' ? 'Survey Records' : 'Account Settings'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm md:text-base">
              {user.username[0].toUpperCase()}
            </div>
          </div>
        </header>

        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              {/* Dashboard Actions */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">Dashboard Overview</h2>
                  <p className="text-slate-500 mt-1">Welcome back, {user.username}</p>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
                <StatCard
                  title="Total Houses Registered"
                  value={stats.totalHouses}
                  icon={<Home className="text-blue-600" />}
                />
                <StatCard
                  title="Total Members Covered"
                  value={stats.totalMembers}
                  icon={<Users className="text-purple-600" />}
                />
              </div>



              {/* Bottom Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  onClick={generateDashboardPDF}
                  className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-sm font-medium transition-colors"
                >
                  <Download size={16} />
                  Download Summary
                </button>
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
                  </FormField>
                  <FormField label="Area / Locality">
                    <input
                      type="text"
                      list="area-suggestions"
                      value={houseForm.area}
                      onChange={(e) => setHouseForm({ ...houseForm, area: e.target.value })}
                      className="form-input"
                      placeholder="e.g. Alappuzha North"
                    />
                    <datalist id="area-suggestions">
                      {uniqueAreas.map((area, i) => <option key={i} value={area} />)}
                    </datalist>
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
                          <input
                            type="text"
                            required
                            value={member.name}
                            onChange={(e) => handleMemberChange(index, 'name', e.target.value)}
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
                            value={member.age}
                            onChange={(e) => handleMemberChange(index, 'age', parseInt(e.target.value))}
                            className="form-input"
                          />
                        </FormField>
                        <FormField label="Job / Education">
                          <input
                            type="text"
                            list="job-suggestions"
                            value={member.occupation} // Storing entirely in 'occupation' now as 'Job / Education'
                            onChange={(e) => {
                              const newMembers = [...members];
                              newMembers[index] = { ...newMembers[index], occupation: e.target.value, education: '' };
                              setMembers(newMembers);
                            }}
                            className="form-input"
                            placeholder="e.g. Teacher, B.Ed, or Student"
                          />
                          <datalist id="job-suggestions">
                            {uniqueJobs.map((job, i) => <option key={i} value={job} />)}
                          </datalist>
                        </FormField>
                        <FormField label="Ration Card Type">
                          <select
                            value={member.ration_card_type}
                            onChange={(e) => handleMemberChange(index, 'ration_card_type', e.target.value)}
                            className="form-input"
                          >
                            <option value="">Select</option>
                            <option>APL</option>
                            <option>BPL</option>
                            <option>Antyodaya (AAY)</option>
                            <option>Non-Priority</option>
                          </select>
                        </FormField>
                        <FormField label="Membership Details">
                          <input
                            type="text"
                            list="membership-suggestions"
                            value={member.membership_details}
                            onChange={(e) => handleMemberChange(index, 'membership_details', e.target.value)}
                            className="form-input"
                            placeholder="e.g. Life Member"
                          />
                          <datalist id="membership-suggestions">
                            {uniqueMemberships.map((membership, i) => <option key={i} value={membership} />)}
                          </datalist>
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
                        <FormField label="Mobile Number">
                          <input
                            type="tel"
                            value={member.phone}
                            onChange={(e) => handleMemberChange(index, 'phone', e.target.value)}
                            className="form-input"
                          />
                        </FormField>
                        <FormField label="Other Details" className="md:col-span-2 lg:col-span-3">
                          <input
                            type="text"
                            value={member.other_details}
                            onChange={(e) => handleMemberChange(index, 'other_details', e.target.value)}
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
                <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="flex-1 w-full">
                    <h3 className="text-lg font-semibold mb-2">All Survey Records</h3>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input
                        type="text"
                        placeholder="Search by house details or area..."
                        value={houseSearch}
                        onChange={(e) => setHouseSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 w-full md:w-auto shrink-0">
                    <button
                      onClick={generateAllRecordsPDF}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded-lg text-xs font-bold transition-colors"
                    >
                      <Download size={14} />
                      Download All Records
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[600px]">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-4 font-medium cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => { setSortBy('details'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}>House Details {sortBy === 'details' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                        <th className="px-6 py-4 font-medium cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => { setSortBy('area'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}>Area/Locality {sortBy === 'area' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                        <th className="px-6 py-4 font-medium">Members</th>
                        <th className="px-6 py-4 font-medium cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => { setSortBy('date'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}>Date {sortBy === 'date' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                        <th className="px-6 py-4 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {houses
                        .filter(h =>
                          h.house_details.toLowerCase().includes(houseSearch.toLowerCase()) ||
                          h.area.toLowerCase().includes(houseSearch.toLowerCase())
                        )
                        .sort((a, b) => {
                          if (!sortBy) return 0;
                          let valA = '';
                          let valB = '';
                          if (sortBy === 'area') { valA = a.area; valB = b.area; }
                          else if (sortBy === 'details') { valA = a.house_details; valB = b.house_details; }
                          else if (sortBy === 'date') { valA = a.created_at || ''; valB = b.created_at || ''; }
                          
                          if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
                          if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
                          return 0;
                        })
                        .map((house) => (
                          <tr
                            key={house.id}
                            className="hover:bg-slate-50 transition-colors cursor-pointer"
                            onClick={() => setSelectedHouse(house)}
                          >
                            <td className="px-6 py-4">
                              <div className="font-medium text-slate-900 line-clamp-2 max-w-[300px]">{house.house_details}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-slate-700">{house.area}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2 text-sm text-slate-600">
                                <Users size={16} />
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
                                  onClick={() => handleDeleteHouse(house.id!)}
                                  className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      {houses.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-slate-400">No records found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* House Details Modal */}
              {selectedHouse && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                      <div>
                        <h3 className="text-xl font-bold text-slate-900">House Details</h3>
                        <p className="text-sm text-slate-500">{selectedHouse.area}</p>
                      </div>
                      <button
                        onClick={() => { setSelectedHouse(null); setEditingMemberId(null); }}
                        className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                      >
                        <X size={24} />
                      </button>
                    </div>

                    <div className="p-8 flex-1 overflow-y-auto space-y-8">
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
                            <input
                              type="text"
                              className="form-input bg-white"
                              value={selectedHouse.area}
                              onChange={(e) => setSelectedHouse({ ...selectedHouse, area: e.target.value })}
                            />
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
                                      body: JSON.stringify({ house_details: selectedHouse.house_details, area: selectedHouse.area })
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
                          <p className="text-slate-800 whitespace-pre-wrap">{selectedHouse.house_details}</p>
                        )}
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            <Users size={20} className="text-emerald-500" />
                            Family Members ({selectedHouse.members?.length || 0})
                          </h4>
                        </div>

                        <div className="space-y-4">
                          {selectedHouse.members?.map((member) => (
                            <div key={member.id} className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-emerald-200 transition-all">
                              {editingMemberId === member.id ? (
                                <form onSubmit={handleUpdateMember} className="space-y-4">
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <FormField label="Name">
                                      <input
                                        type="text"
                                        className="form-input"
                                        value={memberEditForm?.name}
                                        onChange={(e) => setMemberEditForm({ ...memberEditForm!, name: e.target.value })}
                                      />
                                    </FormField>
                                    <FormField label="Age">
                                      <input
                                        type="number"
                                        className="form-input"
                                        value={memberEditForm?.age}
                                        onChange={(e) => setMemberEditForm({ ...memberEditForm!, age: parseInt(e.target.value) })}
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
                                      <input
                                        type="text"
                                        className="form-input"
                                        value={memberEditForm?.occupation}
                                        onChange={(e) => {
                                          setMemberEditForm({ ...memberEditForm!, occupation: e.target.value, education: '' });
                                        }}
                                        placeholder="e.g. Teacher, B.Ed, or Student"
                                      />
                                    </FormField>
                                    <FormField label="Phone">
                                      <input
                                        type="text"
                                        className="form-input"
                                        value={memberEditForm?.phone}
                                        onChange={(e) => setMemberEditForm({ ...memberEditForm!, phone: e.target.value })}
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
                    <input
                      type="password"
                      required
                      value={pwdForm.oldPassword}
                      onChange={(e) => setPwdForm({ ...pwdForm, oldPassword: e.target.value })}
                      className="form-input"
                    />
                  </FormField>
                  <FormField label="New Password">
                    <input
                      type="password"
                      required
                      value={pwdForm.newPassword}
                      onChange={(e) => setPwdForm({ ...pwdForm, newPassword: e.target.value })}
                      className="form-input"
                    />
                  </FormField>
                  <FormField label="Confirm New Password">
                    <input
                      type="password"
                      required
                      value={pwdForm.confirmPassword}
                      onChange={(e) => setPwdForm({ ...pwdForm, confirmPassword: e.target.value })}
                      className="form-input"
                    />
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
        </div>
      </main>

      {/* Confirmation Modal */}
      {
        confirmModal?.open && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 flex flex-col gap-6">
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
    </div >
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

function StatCard({ title, value, icon }: {
  title: string,
  value: string | number,
  icon: React.ReactNode
}) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div className="p-3 rounded-xl bg-slate-50">
          {icon}
        </div>
      </div>
      <div>
        <p className="text-slate-500 text-sm font-medium">{title}</p>
        <h4 className="text-2xl font-bold text-slate-900 mt-1">{value}</h4>
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
