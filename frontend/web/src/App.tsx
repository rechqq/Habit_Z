import { ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import React, { useEffect, useState } from "react";
import { getContractReadOnly, getContractWithSigner } from "./components/useContract";
import "./App.css";
import { useAccount } from 'wagmi';
import { useFhevm, useEncrypt, useDecrypt } from '../fhevm-sdk/src';
import { ethers } from 'ethers';

interface HabitData {
  id: string;
  name: string;
  frequency: number;
  streak: number;
  category: string;
  timestamp: number;
  creator: string;
  publicValue1: number;
  publicValue2: number;
  isVerified?: boolean;
  decryptedValue?: number;
}

interface HabitStats {
  totalHabits: number;
  completedToday: number;
  currentStreak: number;
  successRate: number;
  weeklyProgress: number;
}

const App: React.FC = () => {
  const { address, isConnected } = useAccount();
  const [loading, setLoading] = useState(true);
  const [habits, setHabits] = useState<HabitData[]>([]);
  const [filteredHabits, setFilteredHabits] = useState<HabitData[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingHabit, setCreatingHabit] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{ visible: boolean; status: "pending" | "success" | "error"; message: string; }>({ 
    visible: false, 
    status: "pending", 
    message: "" 
  });
  const [newHabitData, setNewHabitData] = useState({ 
    name: "", 
    frequency: 1, 
    category: "health",
    streak: 0 
  });
  const [selectedHabit, setSelectedHabit] = useState<HabitData | null>(null);
  const [decryptedData, setDecryptedData] = useState<number | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [contractAddress, setContractAddress] = useState("");
  const [fhevmInitializing, setFhevmInitializing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [userHistory, setUserHistory] = useState<any[]>([]);
  const itemsPerPage = 6;

  const { status, initialize, isInitialized } = useFhevm();
  const { encrypt, isEncrypting } = useEncrypt();
  const { verifyDecryption, isDecrypting: fheIsDecrypting } = useDecrypt();

  useEffect(() => {
    const initFhevmAfterConnection = async () => {
      if (!isConnected || isInitialized || fhevmInitializing) return;
      
      try {
        setFhevmInitializing(true);
        await initialize();
      } catch (error) {
        console.error('FHEVM initialization failed:', error);
        setTransactionStatus({ 
          visible: true, 
          status: "error", 
          message: "FHEVM initialization failed" 
        });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      } finally {
        setFhevmInitializing(false);
      }
    };

    initFhevmAfterConnection();
  }, [isConnected, isInitialized, initialize, fhevmInitializing]);

  useEffect(() => {
    const loadDataAndContract = async () => {
      if (!isConnected) {
        setLoading(false);
        return;
      }
      
      try {
        await loadData();
        const contract = await getContractReadOnly();
        if (contract) setContractAddress(await contract.getAddress());
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDataAndContract();
  }, [isConnected]);

  useEffect(() => {
    filterHabits();
  }, [habits, searchTerm, categoryFilter]);

  const filterHabits = () => {
    let filtered = habits;
    
    if (searchTerm) {
      filtered = filtered.filter(habit => 
        habit.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (categoryFilter !== "all") {
      filtered = filtered.filter(habit => habit.category === categoryFilter);
    }
    
    setFilteredHabits(filtered);
    setCurrentPage(1);
  };

  const loadData = async () => {
    if (!isConnected) return;
    
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      await testContractAvailability();
      
      const businessIds = await contract.getAllBusinessIds();
      const habitsList: HabitData[] = [];
      
      for (const businessId of businessIds) {
        try {
          const businessData = await contract.getBusinessData(businessId);
          habitsList.push({
            id: businessId,
            name: businessData.name,
            frequency: Number(businessData.publicValue1) || 1,
            streak: Number(businessData.decryptedValue) || 0,
            category: getCategoryFromValue(Number(businessData.publicValue2)),
            timestamp: Number(businessData.timestamp),
            creator: businessData.creator,
            publicValue1: Number(businessData.publicValue1) || 0,
            publicValue2: Number(businessData.publicValue2) || 0,
            isVerified: businessData.isVerified,
            decryptedValue: Number(businessData.decryptedValue) || 0
          });
        } catch (e) {
          console.error('Error loading habit data:', e);
        }
      }
      
      setHabits(habitsList);
      updateUserHistory("DATA_LOADED", { count: habitsList.length });
    } catch (e) {
      setTransactionStatus({ visible: true, status: "error", message: "Failed to load data" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setIsRefreshing(false); 
    }
  };

  const testContractAvailability = async () => {
    try {
      const contract = await getContractReadOnly();
      if (contract) {
        const available = await contract.isAvailable();
        if (available) {
          updateUserHistory("CONTRACT_TEST", { result: "Available" });
        }
      }
    } catch (e) {
      console.error('Contract availability test failed:', e);
    }
  };

  const getCategoryFromValue = (value: number): string => {
    const categories = ["health", "work", "personal", "fitness", "learning"];
    return categories[value % categories.length] || "personal";
  };

  const getCategoryValue = (category: string): number => {
    const categories = ["health", "work", "personal", "fitness", "learning"];
    return categories.indexOf(category);
  };

  const updateUserHistory = (action: string, data: any) => {
    const historyItem = {
      timestamp: Date.now(),
      action,
      data,
      address: address
    };
    setUserHistory(prev => [historyItem, ...prev.slice(0, 9)]);
  };

  const createHabit = async () => {
    if (!isConnected || !address) { 
      setTransactionStatus({ visible: true, status: "error", message: "Please connect wallet first" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return; 
    }
    
    setCreatingHabit(true);
    setTransactionStatus({ visible: true, status: "pending", message: "Creating habit with FHE encryption..." });
    
    try {
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("Failed to get contract with signer");
      
      const streakValue = newHabitData.streak;
      const businessId = `habit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const encryptedResult = await encrypt(contractAddress, address, streakValue);
      
      const tx = await contract.createBusinessData(
        businessId,
        newHabitData.name,
        encryptedResult.encryptedData,
        encryptedResult.proof,
        newHabitData.frequency,
        getCategoryValue(newHabitData.category),
        `Habit: ${newHabitData.name}`
      );
      
      setTransactionStatus({ visible: true, status: "pending", message: "Waiting for transaction confirmation..." });
      await tx.wait();
      
      setTransactionStatus({ visible: true, status: "success", message: "Habit created with FHE protection!" });
      updateUserHistory("HABIT_CREATED", { name: newHabitData.name, streak: streakValue });
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
      
      await loadData();
      setShowCreateModal(false);
      setNewHabitData({ name: "", frequency: 1, category: "health", streak: 0 });
    } catch (e: any) {
      const errorMessage = e.message?.includes("user rejected transaction") 
        ? "Transaction rejected" 
        : "Creation failed: " + (e.message || "Unknown error");
      setTransactionStatus({ visible: true, status: "error", message: errorMessage });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setCreatingHabit(false); 
    }
  };

  const decryptHabitData = async (habitId: string): Promise<number | null> => {
    if (!isConnected || !address) { 
      setTransactionStatus({ visible: true, status: "error", message: "Please connect wallet first" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return null; 
    }
    
    setIsDecrypting(true);
    try {
      const contractRead = await getContractReadOnly();
      if (!contractRead) return null;
      
      const businessData = await contractRead.getBusinessData(habitId);
      if (businessData.isVerified) {
        const storedValue = Number(businessData.decryptedValue) || 0;
        setTransactionStatus({ visible: true, status: "success", message: "Data already verified" });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
        return storedValue;
      }
      
      const contractWrite = await getContractWithSigner();
      if (!contractWrite) return null;
      
      const encryptedValueHandle = await contractRead.getEncryptedValue(habitId);
      
      const result = await verifyDecryption(
        [encryptedValueHandle],
        contractAddress,
        (abiEncodedClearValues: string, decryptionProof: string) => 
          contractWrite.verifyDecryption(habitId, abiEncodedClearValues, decryptionProof)
      );
      
      setTransactionStatus({ visible: true, status: "pending", message: "Verifying FHE decryption..." });
      
      const clearValue = result.decryptionResult.clearValues[encryptedValueHandle];
      
      await loadData();
      updateUserHistory("DATA_DECRYPTED", { habitId, value: clearValue });
      
      setTransactionStatus({ visible: true, status: "success", message: "FHE decryption verified!" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
      
      return Number(clearValue);
      
    } catch (e: any) { 
      if (e.message?.includes("Data already verified")) {
        setTransactionStatus({ visible: true, status: "success", message: "Data already verified" });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
        await loadData();
        return null;
      }
      
      setTransactionStatus({ visible: true, status: "error", message: "FHE decryption failed" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return null; 
    } finally { 
      setIsDecrypting(false); 
    }
  };

  const calculateStats = (): HabitStats => {
    const totalHabits = habits.length;
    const completedToday = habits.filter(h => h.streak > 0).length;
    const currentStreak = habits.reduce((max, h) => Math.max(max, h.streak), 0);
    const successRate = totalHabits > 0 ? Math.round((completedToday / totalHabits) * 100) : 0;
    const weeklyProgress = Math.min(100, Math.round((completedToday / 7) * 100));

    return { totalHabits, completedToday, currentStreak, successRate, weeklyProgress };
  };

  const renderStats = () => {
    const stats = calculateStats();
    
    return (
      <div className="stats-grid">
        <div className="stat-card neon-purple">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <h3>Total Habits</h3>
            <div className="stat-value">{stats.totalHabits}</div>
          </div>
        </div>
        
        <div className="stat-card neon-blue">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <h3>Completed Today</h3>
            <div className="stat-value">{stats.completedToday}</div>
          </div>
        </div>
        
        <div className="stat-card neon-pink">
          <div className="stat-icon">🔥</div>
          <div className="stat-content">
            <h3>Current Streak</h3>
            <div className="stat-value">{stats.currentStreak} days</div>
          </div>
        </div>
        
        <div className="stat-card neon-green">
          <div className="stat-icon">📈</div>
          <div className="stat-content">
            <h3>Success Rate</h3>
            <div className="stat-value">{stats.successRate}%</div>
          </div>
        </div>
      </div>
    );
  };

  const renderProgressChart = (habit: HabitData) => {
    const progress = Math.min(100, (habit.streak / 30) * 100);
    
    return (
      <div className="progress-chart">
        <div className="chart-header">
          <h4>30-Day Progress</h4>
          <span>{habit.streak}/30 days</span>
        </div>
        <div className="chart-bar">
          <div 
            className="chart-fill neon-gradient"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        <div className="chart-labels">
          <span>0</span>
          <span>15</span>
          <span>30</span>
        </div>
      </div>
    );
  };

  const getCategoryColor = (category: string): string => {
    const colors = {
      health: "neon-pink",
      work: "neon-blue",
      personal: "neon-purple",
      fitness: "neon-green",
      learning: "neon-cyan"
    };
    return colors[category as keyof typeof colors] || "neon-purple";
  };

  const paginatedHabits = filteredHabits.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(filteredHabits.length / itemsPerPage);

  if (!isConnected) {
    return (
      <div className="app-container">
        <header className="app-header">
          <div className="logo">
            <h1>Habit_Z 🔐</h1>
            <p>Private Habit Tracker with FHE</p>
          </div>
          <ConnectButton />
        </header>
        
        <div className="connection-prompt">
          <div className="prompt-content">
            <div className="prompt-icon">🔒</div>
            <h2>Connect Your Wallet to Start Tracking</h2>
            <p>Your habit data is encrypted with FHE technology for complete privacy</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isInitialized || fhevmInitializing) {
    return (
      <div className="loading-screen">
        <div className="fhe-spinner"></div>
        <p>Initializing FHE Encryption System...</p>
      </div>
    );
  }

  if (loading) return (
    <div className="loading-screen">
      <div className="fhe-spinner"></div>
      <p>Loading encrypted habits...</p>
    </div>
  );

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo">
          <h1>Habit_Z 🔐</h1>
          <p>FHE-Protected Habit Tracking</p>
        </div>
        
        <div className="header-actions">
          <button 
            onClick={() => setShowCreateModal(true)} 
            className="create-btn neon-glow"
          >
            + New Habit
          </button>
          <ConnectButton />
        </div>
      </header>

      <div className="main-content">
        <div className="search-filters">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search habits..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          
          <div className="filter-buttons">
            <button 
              className={categoryFilter === "all" ? "active" : ""}
              onClick={() => setCategoryFilter("all")}
            >
              All
            </button>
            {["health", "work", "personal", "fitness", "learning"].map(cat => (
              <button
                key={cat}
                className={categoryFilter === cat ? "active" : ""}
                onClick={() => setCategoryFilter(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {renderStats()}

        <div className="habits-section">
          <div className="section-header">
            <h2>Your Habits</h2>
            <button 
              onClick={loadData} 
              className="refresh-btn"
              disabled={isRefreshing}
            >
              {isRefreshing ? "Refreshing..." : "🔄"}
            </button>
          </div>

          <div className="habits-grid">
            {paginatedHabits.length === 0 ? (
              <div className="no-habits">
                <p>No habits found. Create your first encrypted habit!</p>
              </div>
            ) : paginatedHabits.map((habit, index) => (
              <div 
                key={habit.id}
                className={`habit-card ${getCategoryColor(habit.category)}`}
                onClick={() => setSelectedHabit(habit)}
              >
                <div className="habit-header">
                  <h3>{habit.name}</h3>
                  <span className="habit-category">{habit.category}</span>
                </div>
                
                <div className="habit-stats">
                  <div className="stat">
                    <span>Streak</span>
                    <strong>{habit.streak} days</strong>
                  </div>
                  <div className="stat">
                    <span>Frequency</span>
                    <strong>{habit.frequency}/day</strong>
                  </div>
                </div>

                {renderProgressChart(habit)}

                <div className="habit-status">
                  <span className={habit.isVerified ? "status-verified" : "status-encrypted"}>
                    {habit.isVerified ? "✅ Verified" : "🔒 FHE Encrypted"}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
              >
                Previous
              </button>
              <span>Page {currentPage} of {totalPages}</span>
              <button 
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
              >
                Next
              </button>
            </div>
          )}
        </div>

        <div className="history-section">
          <h3>Recent Activity</h3>
          <div className="history-list">
            {userHistory.slice(0, 5).map((record, index) => (
              <div key={index} className="history-item">
                <span className="history-time">
                  {new Date(record.timestamp).toLocaleTimeString()}
                </span>
                <span className="history-action">
                  {record.action.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showCreateModal && (
        <div className="modal-overlay">
          <div className="create-modal">
            <div className="modal-header">
              <h2>Create New Habit</h2>
              <button onClick={() => setShowCreateModal(false)}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="form-group">
                <label>Habit Name</label>
                <input
                  type="text"
                  value={newHabitData.name}
                  onChange={(e) => setNewHabitData({...newHabitData, name: e.target.value})}
                  placeholder="e.g., Morning Meditation"
                />
              </div>
              
              <div className="form-group">
                <label>Frequency (per day)</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={newHabitData.frequency}
                  onChange={(e) => setNewHabitData({...newHabitData, frequency: parseInt(e.target.value)})}
                />
              </div>
              
              <div className="form-group">
                <label>Category</label>
                <select
                  value={newHabitData.category}
                  onChange={(e) => setNewHabitData({...newHabitData, category: e.target.value})}
                >
                  <option value="health">Health</option>
                  <option value="work">Work</option>
                  <option value="personal">Personal</option>
                  <option value="fitness">Fitness</option>
                  <option value="learning">Learning</option>
                </select>
              </div>
              
              <div className="fhe-notice">
                <strong>FHE Protection</strong>
                <p>Your streak data will be encrypted using Zama FHE technology</p>
              </div>
            </div>
            
            <div className="modal-footer">
              <button 
                onClick={() => setShowCreateModal(false)}
                className="cancel-btn"
              >
                Cancel
              </button>
              <button 
                onClick={createHabit}
                disabled={creatingHabit || !newHabitData.name}
                className="submit-btn neon-glow"
              >
                {creatingHabit ? "Encrypting..." : "Create Habit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedHabit && (
        <div className="modal-overlay">
          <div className="detail-modal">
            <div className="modal-header">
              <h2>{selectedHabit.name}</h2>
              <button onClick={() => setSelectedHabit(null)}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="habit-details">
                <div className="detail-item">
                  <span>Category:</span>
                  <strong>{selectedHabit.category}</strong>
                </div>
                <div className="detail-item">
                  <span>Frequency:</span>
                  <strong>{selectedHabit.frequency}/day</strong>
                </div>
                <div className="detail-item">
                  <span>Current Streak:</span>
                  <strong>{selectedHabit.streak} days</strong>
                </div>
                <div className="detail-item">
                  <span>Encryption Status:</span>
                  <strong>{selectedHabit.isVerified ? "Verified" : "FHE Encrypted"}</strong>
                </div>
              </div>

              {renderProgressChart(selectedHabit)}

              <div className="decryption-section">
                <button 
                  onClick={() => decryptHabitData(selectedHabit.id)}
                  disabled={isDecrypting}
                  className="decrypt-btn neon-glow"
                >
                  {isDecrypting ? "Decrypting..." : "Verify FHE Data"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {transactionStatus.visible && (
        <div className={`transaction-toast ${transactionStatus.status}`}>
          <div className="toast-content">
            <span className="toast-icon">
              {transactionStatus.status === "pending" && "⏳"}
              {transactionStatus.status === "success" && "✅"}
              {transactionStatus.status === "error" && "❌"}
            </span>
            {transactionStatus.message}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;

