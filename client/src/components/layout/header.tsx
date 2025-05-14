  <div className="flex items-center justify-between w-full">
    <div className="flex items-center">
      <button
        onClick={toggleSidebar}
        className="mr-3 p-2 rounded-full hover:bg-gray-100 md:hidden"
        aria-label={isSidebarOpen ? "Chiudi sidebar" : "Apri sidebar"}
      >
        <span className="material-icons">{isSidebarOpen ? "close" : "menu"}</span>
      </button>
      <h1 className="text-xl font-bold hidden sm:block">Da Vittorino Gestione</h1>
    </div>
  </div> 