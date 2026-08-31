$f = 'c:\Users\aleem\OneDrive\Documents\GitHub\seox\src\semanticsx\components\SchemaGenerator.jsx'
$c = Get-Content $f -Raw

# Main page wrappers - remove light backgrounds
$c = $c -replace 'min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 p-6', 'p-6'

# Hero header
$c = $c -replace 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-2xl p-8 text-white mb-8 shadow-xl', 'bg-gradient-to-r from-brand-500 via-amber-500 to-amber-600 rounded-2xl p-8 text-white mb-8 shadow-xl'
$c = $c -replace 'text-indigo-200', 'text-white/70'

# Schema type cards (grid selection)
$c = $c -replace 'bg-white rounded-2xl p-6 border border-gray-200 shadow-lg hover:shadow-xl transition-all cursor-pointer group hover:-translate-y-1', 'rounded-2xl p-6 border border-white/[0.08] bg-[#0d1117] hover:border-brand-500/30 hover:shadow-lg hover:shadow-brand-500/5 transition-all cursor-pointer group hover:-translate-y-1'

# Card titles and descriptions in grid
$c = $c -replace 'text-lg font-bold text-gray-900 mb-2', 'text-lg font-bold text-white/90 mb-2'

# AI-Powered badge
$c = $c -replace 'px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full', 'px-2 py-1 bg-brand-500/15 text-brand-300 text-xs font-medium rounded-full'

# Back button
$c = $c -replace 'flex items-center gap-2 px-4 py-2.5 bg-white text-gray-700 hover:text-gray-900 rounded-xl shadow-sm border border-gray-200 transition font-medium mb-6', 'flex items-center gap-2 px-4 py-2.5 bg-white/[0.04] text-white/60 hover:text-white rounded-xl border border-white/[0.08] transition font-medium mb-6'

# Form panels
$c = $c -replace 'bg-white rounded-2xl shadow-lg border border-gray-200 p-6', 'rounded-2xl border border-white/[0.08] bg-[#0d1117] p-6'

# Form titles
$c = $c -replace 'text-lg font-bold text-gray-900 mb-4', 'text-lg font-bold text-white/90 mb-4'
$c = $c -replace 'text-lg font-bold text-gray-900', 'text-lg font-bold text-white/90'

# Form labels
$c = $c -replace 'block text-sm font-semibold text-gray-700 mb-2', 'block text-sm font-semibold text-white/60 mb-2'
$c = $c -replace 'block text-sm font-semibold text-gray-700 mb-1', 'block text-sm font-semibold text-white/60 mb-1'
$c = $c -replace 'block text-sm font-medium text-gray-700 mb-1', 'block text-sm font-medium text-white/60 mb-1'
$c = $c -replace 'block text-sm font-medium text-gray-700 mb-2', 'block text-sm font-medium text-white/60 mb-2'

# Input fields - replace border-gray-200 inputs
$c = $c -replace 'border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 text-sm', 'border border-white/[0.08] rounded-xl bg-[#010409] text-white/70 placeholder:text-white/20 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500/40 text-sm'
$c = $c -replace 'border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 text-sm', 'border border-white/[0.08] rounded-xl bg-[#010409] text-white/70 placeholder:text-white/20 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500/40 text-sm'
$c = $c -replace 'border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500/30 focus:border-green-500 text-sm', 'border border-white/[0.08] rounded-xl bg-[#010409] text-white/70 placeholder:text-white/20 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500/40 text-sm'
$c = $c -replace 'border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 text-sm', 'border border-white/[0.08] rounded-xl bg-[#010409] text-white/70 placeholder:text-white/20 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500/40 text-sm'
$c = $c -replace 'border border-gray-200 rounded-xl focus:ring-2 focus:ring-pink-500/30 focus:border-pink-500 text-sm', 'border border-white/[0.08] rounded-xl bg-[#010409] text-white/70 placeholder:text-white/20 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500/40 text-sm'
$c = $c -replace 'border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 text-sm', 'border border-white/[0.08] rounded-xl bg-[#010409] text-white/70 placeholder:text-white/20 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500/40 text-sm'
$c = $c -replace 'border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 text-sm', 'border border-white/[0.08] rounded-xl bg-[#010409] text-white/70 placeholder:text-white/20 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500/40 text-sm'
$c = $c -replace 'border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 text-sm', 'border border-white/[0.08] rounded-xl bg-[#010409] text-white/70 placeholder:text-white/20 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500/40 text-sm'
$c = $c -replace 'border border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 text-sm', 'border border-white/[0.08] rounded-xl bg-[#010409] text-white/70 placeholder:text-white/20 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500/40 text-sm'
$c = $c -replace 'border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 text-sm', 'border border-white/[0.08] rounded-xl bg-[#010409] text-white/70 placeholder:text-white/20 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500/40 text-sm'
$c = $c -replace 'border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500/30 focus:border-red-500 text-sm', 'border border-white/[0.08] rounded-xl bg-[#010409] text-white/70 placeholder:text-white/20 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500/40 text-sm'
$c = $c -replace 'border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500 text-sm', 'border border-white/[0.08] rounded-xl bg-[#010409] text-white/70 placeholder:text-white/20 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500/40 text-sm'
$c = $c -replace 'border border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500 text-sm', 'border border-white/[0.08] rounded-xl bg-[#010409] text-white/70 placeholder:text-white/20 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500/40 text-sm'
$c = $c -replace 'border border-gray-200 rounded-xl focus:ring-2 focus:ring-fuchsia-500/30 focus:border-fuchsia-500 text-sm', 'border border-white/[0.08] rounded-xl bg-[#010409] text-white/70 placeholder:text-white/20 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500/40 text-sm'
$c = $c -replace 'border border-gray-200 rounded-xl focus:ring-2 focus:ring-slate-500/30 focus:border-slate-500 text-sm', 'border border-white/[0.08] rounded-xl bg-[#010409] text-white/70 placeholder:text-white/20 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500/40 text-sm'

# Description text under inputs
$c = $c -replace 'text-xs text-gray-500 mt-1', 'text-xs text-white/30 mt-1'
$c = $c -replace 'text-xs text-gray-500', 'text-xs text-white/30'
$c = $c -replace 'text-sm text-gray-500', 'text-sm text-white/40'
$c = $c -replace 'text-sm text-gray-600', 'text-sm text-white/40'
$c = $c -replace 'text-xs text-gray-400', 'text-xs text-white/25'

# Generate buttons - various colors to brand orange
$c = $c -replace 'bg-gradient-to-r from-purple-500 to-indigo-500', 'bg-gradient-to-r from-brand-500 to-amber-600'
$c = $c -replace 'bg-gradient-to-r from-blue-500 to-cyan-500', 'bg-gradient-to-r from-brand-500 to-amber-600'
$c = $c -replace 'bg-gradient-to-r from-green-500 to-emerald-500', 'bg-gradient-to-r from-brand-500 to-amber-600'
$c = $c -replace 'bg-gradient-to-r from-amber-500 to-orange-500', 'bg-gradient-to-r from-brand-500 to-amber-600'
$c = $c -replace 'bg-gradient-to-r from-pink-500 to-rose-500', 'bg-gradient-to-r from-brand-500 to-amber-600'
$c = $c -replace 'bg-gradient-to-r from-indigo-500 to-purple-500', 'bg-gradient-to-r from-brand-500 to-amber-600'
$c = $c -replace 'bg-gradient-to-r from-teal-500 to-cyan-500', 'bg-gradient-to-r from-brand-500 to-amber-600'
$c = $c -replace 'bg-gradient-to-r from-violet-500 to-purple-500', 'bg-gradient-to-r from-brand-500 to-amber-600'
$c = $c -replace 'bg-gradient-to-r from-sky-500 to-blue-500', 'bg-gradient-to-r from-brand-500 to-amber-600'
$c = $c -replace 'bg-gradient-to-r from-emerald-500 to-teal-500', 'bg-gradient-to-r from-brand-500 to-amber-600'
$c = $c -replace 'bg-gradient-to-r from-red-500 to-pink-500', 'bg-gradient-to-r from-brand-500 to-amber-600'
$c = $c -replace 'bg-gradient-to-r from-rose-500 to-red-500', 'bg-gradient-to-r from-brand-500 to-amber-600'
$c = $c -replace 'bg-gradient-to-r from-slate-500 to-gray-600', 'bg-gradient-to-r from-brand-500 to-amber-600'

# Copy button
$c = $c -replace 'bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100', 'bg-brand-500/15 text-brand-300 rounded-lg hover:bg-brand-500/25'

# Empty state
$c = $c -replace 'bg-gray-50 rounded-xl p-8 text-center border-2 border-dashed border-gray-200', 'bg-white/[0.02] rounded-xl p-8 text-center border-2 border-dashed border-white/[0.08]'
$c = $c -replace 'w-12 h-12 text-gray-300 mx-auto mb-3', 'w-12 h-12 text-white/20 mx-auto mb-3'

# Validate section
$c = $c -replace 'p-4 bg-blue-50 rounded-xl border border-blue-200', 'p-4 bg-brand-500/[0.06] rounded-xl border border-brand-500/20'
$c = $c -replace 'font-semibold text-blue-800 mb-2', 'font-semibold text-brand-300 mb-2'
$c = $c -replace 'text-blue-600 hover:underline text-sm', 'text-brand-400 hover:underline text-sm'

# Quick fill sections - light bg backgrounds  
$c = $c -replace "from-purple-50 to-indigo-50", "from-brand-500/[0.04] to-transparent"
$c = $c -replace "from-blue-50 to-cyan-50", "from-brand-500/[0.04] to-transparent"
$c = $c -replace "from-green-50 to-emerald-50", "from-brand-500/[0.04] to-transparent"
$c = $c -replace "from-amber-50 to-orange-50", "from-brand-500/[0.04] to-transparent"
$c = $c -replace "from-pink-50 to-rose-50", "from-brand-500/[0.04] to-transparent"
$c = $c -replace "from-indigo-50 to-purple-50", "from-brand-500/[0.04] to-transparent"
$c = $c -replace "from-teal-50 to-cyan-50", "from-brand-500/[0.04] to-transparent"
$c = $c -replace "from-violet-50 to-purple-50", "from-brand-500/[0.04] to-transparent"
$c = $c -replace "from-sky-50 to-blue-50", "from-brand-500/[0.04] to-transparent"
$c = $c -replace "from-emerald-50 to-teal-50", "from-brand-500/[0.04] to-transparent"
$c = $c -replace "from-red-50 to-pink-50", "from-brand-500/[0.04] to-transparent"
$c = $c -replace "from-rose-50 to-red-50", "from-brand-500/[0.04] to-transparent"
$c = $c -replace "from-stone-50 to-stone-100", "from-brand-500/[0.04] to-transparent"
$c = $c -replace "from-cyan-50 to-blue-50", "from-brand-500/[0.04] to-transparent"
$c = $c -replace "from-fuchsia-50 to-pink-50", "from-brand-500/[0.04] to-transparent"

# Quick fill border colors
$c = $c -replace "border-purple-200", "border-white/[0.08]"
$c = $c -replace "border-blue-200", "border-white/[0.08]"
$c = $c -replace "border-green-200", "border-white/[0.08]"
$c = $c -replace "border-amber-200", "border-white/[0.08]"
$c = $c -replace "border-pink-200", "border-white/[0.08]"
$c = $c -replace "border-indigo-200", "border-white/[0.08]"
$c = $c -replace "border-teal-200", "border-white/[0.08]"
$c = $c -replace "border-violet-200", "border-white/[0.08]"
$c = $c -replace "border-sky-200", "border-white/[0.08]"
$c = $c -replace "border-emerald-200", "border-white/[0.08]"
$c = $c -replace "border-red-200", "border-white/[0.08]"
$c = $c -replace "border-rose-200", "border-white/[0.08]"
$c = $c -replace "border-cyan-200", "border-white/[0.08]"
$c = $c -replace "border-fuchsia-200", "border-white/[0.08]"
$c = $c -replace "border-slate-200", "border-white/[0.08]"
$c = $c -replace "border-gray-200", "border-white/[0.08]"

# Remaining text-gray occurrences
$c = $c -replace 'text-gray-900', 'text-white/90'
$c = $c -replace 'text-gray-800', 'text-white/80'
$c = $c -replace 'text-gray-700', 'text-white/60'
$c = $c -replace 'text-gray-600', 'text-white/50'
$c = $c -replace 'text-gray-500', 'text-white/40'
$c = $c -replace 'text-gray-400', 'text-white/30'
$c = $c -replace 'text-gray-300', 'text-white/20'

# Remaining bg-gray
$c = $c -replace 'bg-gray-100', 'bg-white/[0.06]'
$c = $c -replace 'bg-gray-50', 'bg-white/[0.03]'

Set-Content $f $c -NoNewline
Write-Host "SchemaGenerator.jsx updated successfully"
