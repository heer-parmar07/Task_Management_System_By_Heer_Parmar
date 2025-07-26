import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';

// Lucide React Icons (using inline SVG for simplicity in a single file)
const CalendarIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-calendar"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
);
const KanbanIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-layout-dashboard"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>
);
const ListIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-list-todo"><rect x="3" y="5" width="6" height="6" rx="1"/><path d="m3 17h.01"/><path d="M13 17h8"/><path d="M13 5h8"/><path d="M13 11h8"/></svg>
);
const PlusIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-plus"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
);
const EditIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-edit"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>
);
const TrashIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-trash-2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
);
const XIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
);
const CheckIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-check"><path d="M20 6 9 17l-5-5"/></svg>
);


// Context for Firebase and User
const AppContext = createContext(null);

const App = () => {
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [tasks, setTasks] = useState([]);
    const [users, setUsers] = useState([]);
    const [currentView, setCurrentView] = useState('kanban'); // 'kanban', 'list', 'calendar'
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [notifications, setNotifications] = useState([]);

    // Initialize Firebase and Auth
    useEffect(() => {
        try {
            const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
            const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');

            if (!firebaseConfig || Object.keys(firebaseConfig).length === 0) {
                console.error("Firebase config is missing or empty.");
                return;
            }

            const app = initializeApp(firebaseConfig);
            const firestore = getFirestore(app);
            const firebaseAuth = getAuth(app);

            setDb(firestore);
            setAuth(firebaseAuth);

            // Sign in with custom token or anonymously
            const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

            if (initialAuthToken) {
                signInWithCustomToken(firebaseAuth, initialAuthToken)
                    .then(() => {
                        console.log("Signed in with custom token.");
                    })
                    .catch((error) => {
                        console.error("Error signing in with custom token:", error);
                        signInAnonymously(firebaseAuth)
                            .then(() => console.log("Signed in anonymously."))
                            .catch((anonError) => console.error("Error signing in anonymously:", anonError));
                    });
            } else {
                signInAnonymously(firebaseAuth)
                    .then(() => console.log("Signed in anonymously."))
                    .catch((error) => console.error("Error signing in anonymously:", error));
            }

            // Listen for auth state changes
            const unsubscribeAuth = onAuthStateChanged(firebaseAuth, (user) => {
                if (user) {
                    setUserId(user.uid);
                    setIsAuthReady(true);
                    console.log("Auth state changed, user ID:", user.uid);
                } else {
                    setUserId(null);
                    setIsAuthReady(true);
                    console.log("Auth state changed, no user.");
                }
            });

            return () => unsubscribeAuth();
        } catch (error) {
            console.error("Error initializing Firebase:", error);
        }
    }, []);

    // Fetch tasks and users once auth is ready
    useEffect(() => {
        if (!db || !isAuthReady || !userId) return;

        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

        // Listen for tasks
        const tasksCollectionRef = collection(db, `artifacts/${appId}/public/data/tasks`);
        const unsubscribeTasks = onSnapshot(tasksCollectionRef, (snapshot) => {
            const fetchedTasks = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                dueDate: doc.data().dueDate ? new Date(doc.data().dueDate.toDate()) : null, // Convert Firestore Timestamp to Date
                createdAt: doc.data().createdAt ? new Date(doc.data().createdAt.toDate()) : null,
            }));
            setTasks(fetchedTasks);
            console.log("Tasks updated:", fetchedTasks.length);
        }, (error) => {
            console.error("Error fetching tasks:", error);
        });

        // Listen for users (for assignment dropdown)
        const usersCollectionRef = collection(db, `artifacts/${appId}/public/data/users`);
        const unsubscribeUsers = onSnapshot(usersCollectionRef, (snapshot) => {
            const fetchedUsers = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setUsers(fetchedUsers);
            console.log("Users updated:", fetchedUsers.length);
        }, (error) => {
            console.error("Error fetching users:", error);
        });

        // Add current user to users collection if not exists
        const addUserToUsersCollection = async () => {
            const userDocRef = doc(db, `artifacts/${appId}/public/data/users`, userId);
            const userDocSnap = await getDoc(userDocRef);
            if (!userDocSnap.exists()) {
                await setDoc(userDocRef, {
                    id: userId,
                    name: `User-${userId.substring(0, 6)}`, // Simple name for display
                    createdAt: serverTimestamp(),
                });
                console.log("Current user added to users collection.");
            }
        };
        addUserToUsersCollection();

        return () => {
            unsubscribeTasks();
            unsubscribeUsers();
        };
    }, [db, isAuthReady, userId]);

    // Handle Notifications
    useEffect(() => {
        if (!userId || tasks.length === 0) return;

        const now = new Date();
        const newNotifications = [];

        // Check for upcoming tasks (e.g., due in next 24 hours)
        tasks.forEach(task => {
            if (task.assignedTo === userId && task.status !== 'Done' && task.dueDate) {
                const timeDiff = task.dueDate.getTime() - now.getTime();
                const hoursDiff = timeDiff / (1000 * 60 * 60);

                if (hoursDiff > 0 && hoursDiff <= 24) {
                    newNotifications.push({
                        id: task.id + '-due-soon',
                        type: 'warning',
                        message: `Task "${task.title}" is due soon! (${task.dueDate.toLocaleDateString()})`,
                        timestamp: new Date(),
                    });
                } else if (hoursDiff <= 0 && task.status !== 'Done') {
                     newNotifications.push({
                        id: task.id + '-overdue',
                        type: 'error',
                        message: `Task "${task.title}" is overdue!`,
                        timestamp: new Date(),
                    });
                }
            }
        });

        // Simple notification for new task assignment (could be more sophisticated with change tracking)
        // For now, let's just show a general "Welcome" or "Your tasks updated"
        if (notifications.length === 0 && tasks.length > 0) {
            newNotifications.push({
                id: 'welcome-notification',
                type: 'info',
                message: `Welcome, User-${userId.substring(0,6)}! Your tasks are loaded.`,
                timestamp: new Date(),
            });
        }

        // Filter out duplicates and keep only recent ones (e.g., last 5)
        const uniqueNotifications = Array.from(new Map(newNotifications.map(n => [n.id, n])).values());
        setNotifications(prev => {
            const combined = [...prev, ...uniqueNotifications].sort((a,b) => b.timestamp - a.timestamp);
            const uniqueCombined = Array.from(new Map(combined.map(n => [n.id, n])).values());
            return uniqueCombined.slice(0, 5); // Keep only the latest 5 unique notifications
        });

    }, [tasks, userId]);


    const handleAddTask = () => {
        setEditingTask(null);
        setShowTaskModal(true);
    };

    const handleEditTask = (task) => {
        setEditingTask(task);
        setShowTaskModal(true);
    };

    const handleCloseModal = () => {
        setShowTaskModal(false);
        setEditingTask(null);
    };

    if (!isAuthReady) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200">
                <div className="text-xl font-semibold">Loading application...</div>
            </div>
        );
    }

    return (
        <AppContext.Provider value={{ db, userId, users, tasks, setTasks }}>
            <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 dark:from-gray-800 dark:to-gray-950 font-inter text-gray-800 dark:text-gray-200 p-4 sm:p-6 lg:p-8 rounded-lg shadow-lg">
                {/* Global Styles */}
                <style>{`
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
                    body { font-family: 'Inter', sans-serif; }
                    /* Custom scrollbar for better aesthetics */
                    ::-webkit-scrollbar {
                        width: 8px;
                        height: 8px;
                    }
                    ::-webkit-scrollbar-track {
                        background: #f1f1f1;
                        border-radius: 10px;
                    }
                    ::-webkit-scrollbar-thumb {
                        background: #888;
                        border-radius: 10px;
                    }
                    ::-webkit-scrollbar-thumb:hover {
                        background: #555;
                    }
                `}</style>
                <div className="max-w-7xl mx-auto rounded-lg shadow-2xl bg-white dark:bg-gray-800 p-6 md:p-8 lg:p-10">
                    <header className="flex flex-col sm:flex-row justify-between items-center mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
                        <h1 className="text-3xl font-bold text-indigo-700 dark:text-indigo-400 mb-4 sm:mb-0">
                            TaskFlow
                        </h1>
                        <div className="flex items-center space-x-4">
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                                Your ID: <span className="font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-md text-xs">{userId}</span>
                            </span>
                            <button
                                onClick={handleAddTask}
                                className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition duration-200 ease-in-out"
                            >
                                <PlusIcon className="w-5 h-5 mr-2" /> New Task
                            </button>
                        </div>
                    </header>

                    {/* Notifications */}
                    <div className="mb-6 space-y-2">
                        {notifications.map((notification) => (
                            <div
                                key={notification.id}
                                className={`p-3 rounded-lg flex items-center justify-between text-sm shadow-sm
                                    ${notification.type === 'warning' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100' : ''}
                                    ${notification.type === 'error' ? 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100' : ''}
                                    ${notification.type === 'info' ? 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100' : ''}
                                `}
                            >
                                <span>{notification.message}</span>
                                <span className="text-xs opacity-75">{notification.timestamp.toLocaleTimeString()}</span>
                            </div>
                        ))}
                    </div>

                    {/* Navigation */}
                    <nav className="mb-8 flex justify-center space-x-4">
                        <button
                            onClick={() => setCurrentView('kanban')}
                            className={`flex items-center px-5 py-2 rounded-lg font-medium transition duration-200 ease-in-out
                                ${currentView === 'kanban' ? 'bg-indigo-500 text-white shadow-lg' : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'}
                            `}
                        >
                            <KanbanIcon className="w-5 h-5 mr-2" /> Kanban Board
                        </button>
                        <button
                            onClick={() => setCurrentView('list')}
                            className={`flex items-center px-5 py-2 rounded-lg font-medium transition duration-200 ease-in-out
                                ${currentView === 'list' ? 'bg-indigo-500 text-white shadow-lg' : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'}
                            `}
                        >
                            <ListIcon className="w-5 h-5 mr-2" /> My Tasks
                        </button>
                        <button
                            onClick={() => setCurrentView('calendar')}
                            className={`flex items-center px-5 py-2 rounded-lg font-medium transition duration-200 ease-in-out
                                ${currentView === 'calendar' ? 'bg-indigo-500 text-white shadow-lg' : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'}
                            `}
                        >
                            <CalendarIcon className="w-5 h-5 mr-2" /> Calendar
                        </button>
                    </nav>

                    {/* Main Content Area */}
                    <main>
                        {currentView === 'kanban' && <KanbanBoard onEditTask={handleEditTask} />}
                        {currentView === 'list' && <TaskList onEditTask={handleEditTask} />}
                        {currentView === 'calendar' && <CalendarView onEditTask={handleEditTask} />}
                    </main>

                    {/* Task Modal */}
                    {showTaskModal && (
                        <TaskModal task={editingTask} onClose={handleCloseModal} />
                    )}
                </div>
            </div>
        </AppContext.Provider>
    );
};

const TaskModal = ({ task, onClose }) => {
    const { db, userId, users } = useContext(AppContext);
    const [title, setTitle] = useState(task?.title || '');
    const [description, setDescription] = useState(task?.description || '');
    const [dueDate, setDueDate] = useState(task?.dueDate ? task.dueDate.toISOString().split('T')[0] : '');
    const [assignedTo, setAssignedTo] = useState(task?.assignedTo || '');
    const [status, setStatus] = useState(task?.status || 'To Do');
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!title.trim()) {
            setError('Task title cannot be empty.');
            return;
        }

        const taskData = {
            title: title.trim(),
            description: description.trim(),
            dueDate: dueDate ? new Date(dueDate) : null,
            assignedTo: assignedTo || null,
            status: status,
            updatedAt: serverTimestamp(),
        };

        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const tasksCollectionRef = collection(db, `artifacts/${appId}/public/data/tasks`);

        try {
            if (task) {
                // Update existing task
                const taskDocRef = doc(db, `artifacts/${appId}/public/data/tasks`, task.id);
                await updateDoc(taskDocRef, taskData);
                console.log("Task updated successfully!");
            } else {
                // Add new task
                await addDoc(tasksCollectionRef, {
                    ...taskData,
                    createdAt: serverTimestamp(),
                    createdBy: userId,
                });
                console.log("Task added successfully!");
            }
            onClose();
        } catch (err) {
            console.error("Error saving task:", err);
            setError('Failed to save task. Please try again.');
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-lg p-6 relative transform transition-all duration-300 scale-100 opacity-100">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-full p-1 transition duration-200"
                >
                    <XIcon className="w-6 h-6" />
                </button>
                <h2 className="text-2xl font-bold text-indigo-700 dark:text-indigo-400 mb-6 border-b pb-3">
                    {task ? 'Edit Task' : 'Create New Task'}
                </h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Title <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            id="title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Description
                        </label>
                        <textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows="3"
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                        ></textarea>
                    </div>
                    <div>
                        <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Due Date
                        </label>
                        <input
                            type="date"
                            id="dueDate"
                            value={dueDate}
                            onChange={(e) => setDueDate(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                        />
                    </div>
                    <div>
                        <label htmlFor="assignedTo" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Assigned To
                        </label>
                        <select
                            id="assignedTo"
                            value={assignedTo}
                            onChange={(e) => setAssignedTo(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                        >
                            <option value="">Unassigned</option>
                            {users.map(user => (
                                <option key={user.id} value={user.id}>
                                    {user.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Status
                        </label>
                        <select
                            id="status"
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                        >
                            <option value="To Do">To Do</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Done">Done</option>
                        </select>
                    </div>
                    {error && <p className="text-red-500 text-sm">{error}</p>}
                    <div className="flex justify-end space-x-3 mt-6">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2 bg-gray-300 text-gray-800 rounded-lg shadow-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition duration-200"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-5 py-2 bg-indigo-600 text-white rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition duration-200"
                        >
                            {task ? 'Update Task' : 'Create Task'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const TaskCard = ({ task, onEditTask }) => {
    const { db } = useContext(AppContext);
    const getStatusColor = (status) => {
        switch (status) {
            case 'To Do': return 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100';
            case 'In Progress': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100';
            case 'Done': return 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100';
            default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
        }
    };

    const handleDelete = async () => {
        if (window.confirm(`Are you sure you want to delete "${task.title}"?`)) {
            try {
                const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
                const taskDocRef = doc(db, `artifacts/${appId}/public/data/tasks`, task.id);
                await deleteDoc(taskDocRef);
                console.log("Task deleted successfully!");
            } catch (error) {
                console.error("Error deleting task:", error);
                // In a real app, use a proper modal for error messages
                alert("Failed to delete task. Please try again.");
            }
        }
    };

    const getDueDateColor = (dueDate) => {
        if (!dueDate) return '';
        const now = new Date();
        now.setHours(0, 0, 0, 0); // Normalize to start of day
        const taskDue = new Date(dueDate);
        taskDue.setHours(0, 0, 0, 0);

        if (taskDue < now) {
            return 'text-red-600 dark:text-red-400 font-semibold'; // Overdue
        } else if (taskDue.getTime() === now.getTime()) {
            return 'text-orange-600 dark:text-orange-400 font-semibold'; // Due today
        } else {
            return 'text-gray-500 dark:text-gray-400';
        }
    };


    return (
        <div className="bg-white dark:bg-gray-700 rounded-lg shadow-md p-4 mb-4 border border-gray-200 dark:border-gray-600 hover:shadow-lg transition-shadow duration-200 ease-in-out">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{task.title}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">{task.description}</p>
            <div className="flex flex-wrap items-center justify-between text-xs mb-3">
                {task.assignedTo && (
                    <span className="bg-purple-100 text-purple-800 dark:bg-purple-800 dark:text-purple-100 px-2 py-1 rounded-full mr-2 mb-1">
                        Assigned: {task.assignedTo.substring(0, 6)}...
                    </span>
                )}
                <span className={`${getStatusColor(task.status)} px-2 py-1 rounded-full mr-2 mb-1`}>
                    {task.status}
                </span>
                {task.dueDate && (
                    <span className={`px-2 py-1 rounded-full ${getDueDateColor(task.dueDate)} mb-1`}>
                        Due: {task.dueDate.toLocaleDateString()}
                    </span>
                )}
            </div>
            <div className="flex justify-end space-x-2">
                <button
                    onClick={() => onEditTask(task)}
                    className="p-2 rounded-full text-indigo-600 hover:bg-indigo-100 dark:text-indigo-400 dark:hover:bg-gray-600 transition duration-200"
                    title="Edit Task"
                >
                    <EditIcon className="w-5 h-5" />
                </button>
                <button
                    onClick={handleDelete}
                    className="p-2 rounded-full text-red-600 hover:bg-red-100 dark:text-red-400 dark:hover:bg-gray-600 transition duration-200"
                    title="Delete Task"
                >
                    <TrashIcon className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
};

const KanbanBoard = ({ onEditTask }) => {
    const { tasks, db } = useContext(AppContext);

    const statuses = ['To Do', 'In Progress', 'Done'];

    const handleDragStart = (e, task) => {
        e.dataTransfer.setData('taskId', task.id);
    };

    const handleDragOver = (e) => {
        e.preventDefault(); // Allow drop
    };

    const handleDrop = async (e, newStatus) => {
        e.preventDefault();
        const taskId = e.dataTransfer.getData('taskId');
        const taskToUpdate = tasks.find(task => task.id === taskId);

        if (taskToUpdate && taskToUpdate.status !== newStatus) {
            try {
                const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
                const taskDocRef = doc(db, `artifacts/${appId}/public/data/tasks`, taskId);
                await updateDoc(taskDocRef, { status: newStatus, updatedAt: serverTimestamp() });
                console.log(`Task ${taskId} moved to ${newStatus}`);
            } catch (error) {
                console.error("Error updating task status:", error);
            }
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {statuses.map(status => (
                <div
                    key={status}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, status)}
                    className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow-inner p-4 min-h-[300px] border border-gray-200 dark:border-gray-700"
                >
                    <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 pb-2 border-b border-gray-300 dark:border-gray-600">
                        {status} ({tasks.filter(task => task.status === status).length})
                    </h2>
                    <div className="space-y-4 overflow-y-auto max-h-[calc(100vh-300px)] pr-2"> {/* Added max-height and overflow */}
                        {tasks
                            .filter(task => task.status === status)
                            .sort((a, b) => (a.dueDate || new Date('9999-12-31')) - (b.dueDate || new Date('9999-12-31'))) // Sort by due date
                            .map(task => (
                                <div key={task.id} draggable onDragStart={(e) => handleDragStart(e, task)}>
                                    <TaskCard task={task} onEditTask={onEditTask} />
                                </div>
                            ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

const TaskList = ({ onEditTask }) => {
    const { tasks, userId } = useContext(AppContext);

    const myTasks = tasks.filter(task => task.assignedTo === userId).sort((a,b) => (a.dueDate || new Date('9999-12-31')) - (b.dueDate || new Date('9999-12-31')));
    const otherTasks = tasks.filter(task => task.assignedTo !== userId).sort((a,b) => (a.dueDate || new Date('9999-12-31')) - (b.dueDate || new Date('9999-12-31')));

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-2xl font-bold text-indigo-700 dark:text-indigo-400 mb-4">
                    My Assigned Tasks ({myTasks.length})
                </h2>
                {myTasks.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400">You have no tasks assigned to you. Time to relax or create some!</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {myTasks.map(task => (
                            <TaskCard key={task.id} task={task} onEditTask={onEditTask} />
                        ))}
                    </div>
                )}
            </div>

            <div>
                <h2 className="text-2xl font-bold text-indigo-700 dark:text-indigo-400 mb-4">
                    All Other Tasks ({otherTasks.length})
                </h2>
                {otherTasks.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400">No other tasks available.</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {otherTasks.map(task => (
                            <TaskCard key={task.id} task={task} onEditTask={onEditTask} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const CalendarView = ({ onEditTask }) => {
    const { tasks } = useContext(AppContext);
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const getDaysInMonth = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        return new Date(year, month + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        return new Date(year, month, 1).getDay(); // 0 for Sunday, 1 for Monday
    };

    const renderCalendarDays = () => {
        const daysInMonth = getDaysInMonth(currentMonth);
        const firstDay = getFirstDayOfMonth(currentMonth);
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();

        const days = [];
        // Fill leading empty days
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="p-2 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-800"></div>);
        }

        // Fill days with tasks
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const tasksOnDay = tasks.filter(task =>
                task.dueDate &&
                task.dueDate.getFullYear() === year &&
                task.dueDate.getMonth() === month &&
                task.dueDate.getDate() === day
            );

            const isToday = date.toDateString() === new Date().toDateString();

            days.push(
                <div
                    key={day}
                    className={`p-2 border border-gray-200 dark:border-gray-700 rounded-md flex flex-col min-h-[120px]
                        ${isToday ? 'bg-indigo-100 dark:bg-indigo-900 border-indigo-400 dark:border-indigo-600' : 'bg-white dark:bg-gray-700'}
                    `}
                >
                    <div className={`font-bold mb-1 ${isToday ? 'text-indigo-800 dark:text-indigo-200' : 'text-gray-800 dark:text-gray-200'}`}>
                        {day}
                    </div>
                    <div className="flex-grow overflow-y-auto space-y-1 pr-1">
                        {tasksOnDay.length > 0 ? (
                            tasksOnDay.map(task => (
                                <div
                                    key={task.id}
                                    className={`text-xs p-1 rounded-md cursor-pointer hover:opacity-80
                                        ${task.status === 'Done' ? 'bg-green-200 text-green-900 dark:bg-green-700 dark:text-green-100' : 'bg-blue-200 text-blue-900 dark:bg-blue-700 dark:text-blue-100'}
                                    `}
                                    onClick={() => onEditTask(task)}
                                    title={task.title}
                                >
                                    {task.title}
                                </div>
                            ))
                        ) : (
                            <p className="text-xs text-gray-400 dark:text-gray-500">No tasks</p>
                        )}
                    </div>
                </div>
            );
        }
        return days;
    };

    const goToPreviousMonth = () => {
        setCurrentMonth(prevMonth => {
            const newMonth = new Date(prevMonth);
            newMonth.setMonth(newMonth.getMonth() - 1);
            return newMonth;
        });
    };

    const goToNextMonth = () => {
        setCurrentMonth(prevMonth => {
            const newMonth = new Date(prevMonth);
            newMonth.setMonth(newMonth.getMonth() + 1);
            return newMonth;
        });
    };

    return (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow-inner p-6">
            <div className="flex justify-between items-center mb-6">
                <button
                    onClick={goToPreviousMonth}
                    className="p-2 rounded-full bg-indigo-500 text-white hover:bg-indigo-600 transition duration-200"
                >
                    &lt;
                </button>
                <h3 className="text-2xl font-semibold text-gray-800 dark:text-gray-200">
                    {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </h3>
                <button
                    onClick={goToNextMonth}
                    className="p-2 rounded-full bg-indigo-500 text-white hover:bg-indigo-600 transition duration-200"
                >
                    &gt;
                </button>
            </div>
            <div className="grid grid-cols-7 gap-2 text-center font-medium text-gray-700 dark:text-gray-300 mb-4">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="py-2">{day}</div>
                ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
                {renderCalendarDays()}
            </div>
        </div>
    );
};

export default App;
