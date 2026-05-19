export default function DashboardLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="bg-white border border-gray-300 shadow-sm">
        <div className="bg-[#06013E] h-12 border-b-4 border-[#FF9000]" />
        <div className="bg-gray-50 border-b border-gray-300 h-12" />
        <div className="p-6 space-y-3">
          <div className="h-10 bg-gray-100 rounded" />
          <div className="h-10 bg-gray-100 rounded" />
          <div className="h-10 bg-gray-100 rounded" />
          <div className="h-10 bg-gray-100 rounded" />
          <div className="h-10 bg-gray-100 rounded" />
        </div>
      </div>
    </div>
  );
}
