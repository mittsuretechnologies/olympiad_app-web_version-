export default function SchoolLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="bg-white rounded-2xl shadow-[0_2px_14px_rgba(0,0,0,0.06)] border border-[#E7EBF2] overflow-hidden">
        <div className="bg-gradient-to-r from-[#0d1a6e] to-[#1559C7] h-14" />
        <div className="bg-gray-50 border-b border-gray-100 h-12" />
        <div className="p-6 space-y-3">
          <div className="h-10 bg-gray-100 rounded-xl" />
          <div className="h-10 bg-gray-100 rounded-xl" />
          <div className="h-10 bg-gray-100 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
