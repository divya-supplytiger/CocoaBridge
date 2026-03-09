import React from 'react'

const TabsJoinButton = ({ tabs, activeTab, setActiveTab}) => {
  return (
        <div className="join">
            {
                tabs.map((tab) => (
                    <button
                        key={tab.value}
                        className={`join-item btn btn-sm text-accent-content ${activeTab === tab.value ? "btn-secondary border-secondary-content/20" : "bg-accent/40 hover:bg-accent/60 border border-accent-content/40"}`}
                        onClick={() => setActiveTab(tab.value)}
                    >
                        {tab.label}
                    </button>
                ))
            }
        </div>
  )
};

export default TabsJoinButton;
