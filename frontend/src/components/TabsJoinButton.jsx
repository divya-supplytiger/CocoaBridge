import React from 'react'

const TabsJoinButton = ({ tabs, activeTab, setActiveTab}) => {
  return (
        <div className="join">
            {
                tabs.map((tab) => (
                    <button
                        key={tab.value}
                        className={`join-item btn btn-sm ${activeTab === tab.value ? "btn-primary border-primary-content/20 text-secondary-content" : "bg-accent/40 hover:bg-accent/60 border border-accent-content/40 text-accent-content"}`}
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
