import React, { useState, useEffect } from 'react';
import { Activity, Heart, Brain, Target, Plus, Trash2, LogOut, Loader } from 'lucide-react';

export default function FitnessOS() {
  const [activeTab, setActiveTab] = useState('overview');
  
  // Strava Integration
  const [stravaConnected, setStravaConnected] = useState(!!localStorage.getItem('strava_token'));
  const [stravaRuns, setStravaRuns] = useState([]);
  const [loadingStrava, setLoadingStrava] = useState(false);
  const [stravaError, setStravaError] = useState(null);

  // YOUR STRAVA CREDENTIALS
  const STRAVA_CLIENT_ID = "247088";
  const STRAVA_CLIENT_SECRET = "97d5b71909f5f8212229926307c1b029f7a05828";
  const STRAVA_REDIRECT_URI = window.location.origin;

  // Protein Tracker State
  const DAILY_PROTEIN_TARGET = 175;
  const [meals, setMeals] = useState([
    { id: 1, time: '7:00 AM', item: 'Protein Shake', protein: 30 },
    { id: 2, time: '12:30 PM', item: 'Chicken Breast (100g cooked)', protein: 48 },
  ]);
  const [newMeal, setNewMeal] = useState({ time: '', item: '', protein: '' });

  const commonFoods = [
    { name: 'Chicken Breast (100g cooked)', protein: 48 },
    { name: 'Salmon (100g cooked)', protein: 35 },
    { name: 'Ground Beef (100g cooked)', protein: 26 },
    { name: 'Eggs (1 large)', protein: 6 },
    { name: 'Greek Yogurt (1 cup)', protein: 20 },
    { name: 'Cottage Cheese (1 cup)', protein: 28 },
    { name: 'Protein Shake (1 scoop)', protein: 30 },
    { name: 'Tuna (100g canned)', protein: 26 },
    { name: 'Turkey Breast (100g cooked)', protein: 45 },
    { name: 'Milk (1 cup)', protein: 8 },
  ];

  const totalProtein = meals.reduce((sum, m) => sum + m.protein, 0);
  const remainingProtein = Math.max(0, DAILY_PROTEIN_TARGET - totalProtein);
  const proteinPercentage = (totalProtein / DAILY_PROTEIN_TARGET) * 100;

  // Handle Strava OAuth
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    
    if (code && !stravaConnected) {
      exchangeStravaCode(code);
    } else if (stravaConnected && stravaRuns.length === 0) {
      const token = localStorage.getItem('strava_token');
      if (token) {
        fetchStravaRuns(token);
      }
    }
  }, [stravaConnected, stravaRuns.length]);

  const exchangeStravaCode = async (code) => {
    setLoadingStrava(true);
    try {
      const response = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: parseInt(STRAVA_CLIENT_ID),
          client_secret: STRAVA_CLIENT_SECRET,
          code: code,
          grant_type: 'authorization_code'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to authenticate with Strava');
      }

      const data = await response.json();
      localStorage.setItem('strava_token', data.access_token);
      setStravaConnected(true);
      await fetchStravaRuns(data.access_token);
      setStravaError(null);
      
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (err) {
      setStravaError(err.message);
      console.error('Strava auth error:', err);
    } finally {
      setLoadingStrava(false);
    }
  };

  const fetchStravaRuns = async (token) => {
    setLoadingStrava(true);
    try {
      const response = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=50', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch Strava runs');
      }

      const activities = await response.json();
      
      const runs = activities
        .filter(a => a.type === 'Run')
        .map(a => ({
          id: a.id,
          date: new Date(a.start_date),
          name: a.name,
          distance_miles: (a.distance / 1609.34).toFixed(2),
          duration_minutes: Math.round(a.moving_time / 60),
          pace_min_per_mi: (a.moving_time / 60 / (a.distance / 1609.34)).toFixed(2),
          elevation_gain: a.elevation_gain ? Math.round(a.elevation_gain * 3.28084) : 0,
          avg_hr: a.average_heartrate ? Math.round(a.average_heartrate) : null,
        }))
        .sort((a, b) => b.date - a.date);

      setStravaRuns(runs);
      setStravaError(null);
    } catch (err) {
      setStravaError(err.message);
      console.error('Error fetching Strava runs:', err);
    } finally {
      setLoadingStrava(false);
    }
  };

  const connectStrava = () => {
    const scope = 'activity:read_all,profile:read_all';
    const authUrl = `https://www.strava.com/oauth/authorize?client_id=${STRAVA_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(STRAVA_REDIRECT_URI)}&scope=${scope}`;
    window.location.href = authUrl;
  };

  const disconnectStrava = () => {
    localStorage.removeItem('strava_token');
    setStravaConnected(false);
    setStravaRuns([]);
    setStravaError(null);
  };

  const getWeeklyStats = () => {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());

    const weekRuns = stravaRuns.filter(run => {
      const runDate = new Date(run.date);
      return runDate >= weekStart && runDate <= now;
    });

    const totalMiles = weekRuns.reduce((sum, run) => sum + parseFloat(run.distance_miles), 0);
    const avgPace = weekRuns.length > 0 
      ? weekRuns.reduce((sum, run) => sum + parseFloat(run.pace_min_per_mi), 0) / weekRuns.length
      : 0;
    const longRun = Math.max(...weekRuns.map(r => parseFloat(r.distance_miles)), 0);

    const paceMinutes = Math.floor(avgPace);
    const paceSeconds = Math.round((avgPace - paceMinutes) * 60);

    return {
      totalMiles: totalMiles.toFixed(1),
      avgPace: `${paceMinutes}:${paceSeconds.toString().padStart(2, '0')}`,
      longRun: longRun.toFixed(1),
      runsCount: weekRuns.length,
      allRuns: weekRuns
    };
  };

  const weeklyStats = stravaConnected ? getWeeklyStats() : null;

  const marathonPlan = [
    { week: 1, phase: 'Base Building', longRun: '10.8', weeklyMileage: '42' },
    { week: 2, phase: 'Base Building', longRun: '11.6', weeklyMileage: '44' },
    { week: 3, phase: 'Base Building', longRun: '12.3', weeklyMileage: '45' },
    { week: 4, phase: 'Base Building', longRun: '13.1', weeklyMileage: '47' },
    { week: 5, phase: 'Base Building', longRun: '13.8', weeklyMileage: '48' },
    { week: 6, phase: 'Base Building', longRun: '14.6', weeklyMileage: '50' },
    { week: 7, phase: 'Base Building', longRun: '15.3', weeklyMileage: '51' },
    { week: 8, phase: 'Base Building', longRun: '16.1', weeklyMileage: '52' },
    { week: 9, phase: 'Build', longRun: '17.1', weeklyMileage: '54' },
    { week: 10, phase: 'Build', longRun: '18.1', weeklyMileage: '55' },
    { week: 11, phase: 'Build', longRun: '19.1', weeklyMileage: '55' },
    { week: 12, phase: 'Build', longRun: '20.1', weeklyMileage: '54' },
    { week: 13, phase: 'Peak', longRun: '17.1', weeklyMileage: '50' },
    { week: 14, phase: 'Peak', longRun: '14.1', weeklyMileage: '45' },
    { week: 15, phase: 'Peak', longRun: '10', weeklyMileage: '35' },
    { week: 16, phase: 'Race Week', longRun: '0', weeklyMileage: '15' },
  ];

  const addMeal = () => {
    if (newMeal.item && newMeal.protein) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      setMeals([
        ...meals,
        {
          id: Date.now(),
          time: newMeal.time || timeStr,
          item: newMeal.item,
          protein: parseInt(newMeal.protein)
        }
      ]);
      setNewMeal({ time: '', item: '', protein: '' });
    }
  };

  const deleteMeal = (id) => {
    setMeals(meals.filter(m => m.id !== id));
  };

  const addQuickFood = (food) => {
    setMeals([
      ...meals,
      {
        id: Date.now() + Math.random(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        item: food.name,
        protein: food.protein
      }
    ]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white font-sans">
      <div className="fixed inset-0 opacity-30 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500 rounded-full mix-blend-screen filter blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500 rounded-full mix-blend-screen filter blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="relative z-10">
        {/* Header */}
        <div className="border-b border-slate-700/50 bg-slate-900/80 backdrop-blur sticky top-0 z-20">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">FitnessOS</h1>
                <p className="text-slate-400 text-sm mt-1">Marathon Training Optimizer • 4hr Goal • 175 lbs @ 12% BF</p>
              </div>
            </div>

            {/* Strava Status */}
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {stravaConnected ? (
                  <div className="flex items-center gap-2 px-4 py-2 bg-green-900/30 border border-green-700/50 rounded-lg">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium">✓ Strava Connected</span>
                    {loadingStrava && <Loader className="w-4 h-4 animate-spin" />}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-4 py-2 bg-slate-700/30 border border-slate-600/50 rounded-lg">
                    <span className="text-sm font-medium">Not Connected to Strava</span>
                  </div>
                )}
                {stravaError && (
                  <div className="text-sm text-red-400">Error: {stravaError}</div>
                )}
              </div>
              <div className="flex gap-2">
                {stravaConnected ? (
                  <button
                    onClick={disconnectStrava}
                    className="px-4 py-2 text-sm bg-red-600/20 hover:bg-red-600/30 border border-red-600/50 rounded-lg transition flex items-center gap-2 text-red-300"
                  >
                    <LogOut className="w-4 h-4" />
                    Disconnect
                  </button>
                ) : (
                  <button
                    onClick={connectStrava}
                    className="px-4 py-2 text-sm bg-orange-600 hover:bg-orange-700 rounded-lg transition font-medium flex items-center gap-2"
                  >
                    🔗 Connect Strava
                  </button>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-4">
              {['overview', 'marathonPlan', 'protein'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-lg whitespace-nowrap transition-all duration-300 font-medium ${
                    activeTab === tab
                      ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {tab === 'overview' && '📊 Overview'}
                  {tab === 'marathonPlan' && '🏃 Marathon Plan'}
                  {tab === 'protein' && '🥗 Protein'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
            {stravaConnected && weeklyStats && (
              <div className="bg-gradient-to-r from-orange-600/20 to-red-600/20 border border-orange-600/30 rounded-xl p-6">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Your Strava Running Data (This Week)
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-slate-800/50 rounded-lg p-4">
                    <div className="text-sm text-slate-400 mb-1">Total Mileage</div>
                    <div className="text-2xl font-bold text-orange-400">{weeklyStats.totalMiles} mi</div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-4">
                    <div className="text-sm text-slate-400 mb-1">Runs This Week</div>
                    <div className="text-2xl font-bold text-blue-400">{weeklyStats.runsCount}</div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-4">
                    <div className="text-sm text-slate-400 mb-1">Avg Pace</div>
                    <div className="text-2xl font-bold text-purple-400">{weeklyStats.avgPace}</div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-4">
                    <div className="text-sm text-slate-400 mb-1">Longest Run</div>
                    <div className="text-2xl font-bold text-green-400">{weeklyStats.longRun} mi</div>
                  </div>
                </div>

                {weeklyStats.allRuns.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-3">Recent Runs</h4>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {weeklyStats.allRuns.map(run => (
                        <div key={run.id} className="bg-slate-700/30 rounded-lg p-3 flex justify-between items-center hover:bg-slate-700/50 transition">
                          <div>
                            <div className="font-medium text-sm">{run.name}</div>
                            <div className="text-xs text-slate-400">{run.date.toLocaleDateString()} • {run.duration_minutes} min</div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-sm">{run.distance_miles} mi</div>
                            <div className="text-xs text-slate-400">{run.pace_min_per_mi} min/mi</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!stravaConnected && (
              <div className="bg-blue-900/30 border border-blue-700/50 rounded-xl p-6 text-center">
                <h3 className="text-lg font-bold mb-2">Connect Your Strava</h3>
                <p className="text-slate-300 mb-4">Click the "Connect Strava" button above to authorize FitnessOS to access your running data.</p>
                <p className="text-sm text-slate-400">Once connected, your runs will appear here automatically.</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl p-6 text-white shadow-lg border border-white/10">
                <div className="text-sm opacity-80 mb-2">Marathon Projection</div>
                <div className="text-2xl font-bold">3:58:23</div>
                <div className="text-xs opacity-70 mt-1">Current fitness level</div>
              </div>
              <div className="bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl p-6 text-white shadow-lg border border-white/10">
                <div className="text-sm opacity-80 mb-2">Recovery Score</div>
                <div className="text-2xl font-bold">68/100</div>
                <div className="text-xs opacity-70 mt-1">Green (optimal)</div>
              </div>
              <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl p-6 text-white shadow-lg border border-white/10">
                <div className="text-sm opacity-80 mb-2">HRV</div>
                <div className="text-2xl font-bold">55 ms</div>
                <div className="text-xs opacity-70 mt-1">Trending up 8%</div>
              </div>
              <div className="bg-gradient-to-br from-orange-500 to-red-500 rounded-xl p-6 text-white shadow-lg border border-white/10">
                <div className="text-sm opacity-80 mb-2">Body Comp Goal</div>
                <div className="text-2xl font-bold">175 @ 12%</div>
                <div className="text-xs opacity-70 mt-1">ETA: Oct 28</div>
              </div>
            </div>
          </div>
        )}

        {/* PROTEIN TRACKER TAB */}
        {activeTab === 'protein' && (
          <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl backdrop-blur p-8">
              <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="relative w-48 h-48 flex-shrink-0">
                  <svg className="w-48 h-48" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="96" cy="96" r="85" fill="none" stroke="#334155" strokeWidth="8" opacity="0.5" />
                    <circle
                      cx="96"
                      cy="96"
                      r="85"
                      fill="none"
                      stroke={proteinPercentage >= 100 ? '#10B981' : '#60A5FA'}
                      strokeWidth="8"
                      strokeDasharray={`${(proteinPercentage / 100) * 534.07} 534.07`}
                      strokeLinecap="round"
                      className="transition-all duration-300"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className="text-4xl font-bold">{totalProtein}</div>
                    <div className="text-sm text-slate-400">/ {DAILY_PROTEIN_TARGET}g</div>
                    <div className="text-xs text-slate-500 mt-1">{Math.round(proteinPercentage)}%</div>
                  </div>
                </div>

                <div className="flex-1 space-y-4">
                  <div>
                    <div className="text-sm text-slate-400 mb-1">Remaining Today</div>
                    <div className={`text-3xl font-bold ${remainingProtein > 0 ? 'text-blue-400' : 'text-green-400'}`}>
                      {remainingProtein > 0 ? `${remainingProtein}g` : '✓ Goal Met!'}
                    </div>
                  </div>
                  {remainingProtein > 0 && (
                    <p className="text-sm text-slate-400">
                      💡 Quick options: 1 chicken meal (48g) + 1 shake (30g) = {remainingProtein}g
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl backdrop-blur p-6">
              <h2 className="text-xl font-bold mb-4">📋 Today's Meals</h2>
              <div className="space-y-3 mb-6">
                {meals.map(meal => (
                  <div key={meal.id} className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg hover:bg-slate-700/50 transition">
                    <div className="flex-1">
                      <div className="font-semibold">{meal.item}</div>
                      <div className="text-xs text-slate-400">{meal.time}</div>
                    </div>
                    <div className="text-right mr-4">
                      <div className="font-bold text-blue-400">{meal.protein}g</div>
                    </div>
                    <button onClick={() => deleteMeal(meal.id)} className="p-2 hover:bg-red-600/30 rounded text-red-400 hover:text-red-300 transition">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="bg-slate-700/20 rounded-lg p-4 mb-4">
                <h3 className="font-semibold mb-3">Quick Add Meal</h3>
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Meal name"
                    value={newMeal.item}
                    onChange={(e) => setNewMeal({ ...newMeal, item: e.target.value })}
                    className="w-full bg-slate-600 text-white px-3 py-2 rounded outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex gap-3">
                    <input
                      type="number"
                      placeholder="Protein (g)"
                      value={newMeal.protein}
                      onChange={(e) => setNewMeal({ ...newMeal, protein: e.target.value })}
                      className="flex-1 bg-slate-600 text-white px-3 py-2 rounded outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button onClick={addMeal} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded flex items-center gap-2 transition font-medium">
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3">Common Foods (Click to Add)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {commonFoods.map((food, idx) => (
                    <button
                      key={idx}
                      onClick={() => addQuickFood(food)}
                      className="text-left p-3 bg-slate-600/40 hover:bg-slate-600/60 rounded flex justify-between items-center text-sm transition"
                    >
                      <span>{food.name}</span>
                      <span className="font-bold text-blue-300">{food.protein}g</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MARATHON PLAN TAB */}
        {activeTab === 'marathonPlan' && (
          <div className="max-w-7xl mx-auto px-6 py-8">
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-8 backdrop-blur">
              <h2 className="text-2xl font-bold mb-6">16-Week Marathon Plan</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-3 px-4 font-semibold">Week</th>
                      <th className="text-left py-3 px-4 font-semibold">Phase</th>
                      <th className="text-center py-3 px-4 font-semibold">Long Run (mi)</th>
                      <th className="text-center py-3 px-4 font-semibold">Weekly Mileage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {marathonPlan.map(week => (
                      <tr key={week.week} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition">
                        <td className="py-3 px-4">{week.week}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-block px-3 py-1 rounded text-xs font-medium ${
                            week.phase === 'Base Building' ? 'bg-blue-900/50 text-blue-300' :
                            week.phase === 'Build' ? 'bg-yellow-900/50 text-yellow-300' :
                            week.phase === 'Peak' ? 'bg-red-900/50 text-red-300' :
                            'bg-green-900/50 text-green-300'
                          }`}>
                            {week.phase}
                          </span>
                        </td>
                        <td className="text-center py-3 px-4 font-semibold">{week.longRun}</td>
                        <td className="text-center py-3 px-4">{week.weeklyMileage}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
