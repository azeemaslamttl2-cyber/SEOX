$f = Join-Path $PSScriptRoot 'src\semanticsx\components\CompetitorSchemaChecker.jsx'
$c = Get-Content $f -Raw

# Page wrapper
$c = $c -replace 'min-h-screen bg-gradient-to-br from-slate-50 to-cyan-50 p-3 md:p-6', 'p-3 md:p-6'

# Hero header
$c = $c -replace 'bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 rounded-2xl p-4 md:p-8 text-white mb-6 shadow-xl', 'bg-gradient-to-r from-brand-500 via-amber-500 to-amber-600 rounded-2xl p-4 md:p-8 text-white mb-6 shadow-xl'
$c = $c -replace 'text-cyan-200', 'text-white/70'
$c = $c -replace 'text-cyan-100', 'text-white/60'

# URL Input card
$c = $c -replace 'bg-white rounded-2xl shadow-lg border border-gray-200 p-4 md:p-6 mb-6', 'rounded-2xl border border-white/[0.08] bg-[#0d1117] p-4 md:p-6 mb-6'

# Section headers
$c = $c -replace 'text-lg font-semibold text-gray-900', 'text-lg font-semibold text-white/90'

# Icon accents
$c = $c -replace 'text-cyan-600', 'text-brand-400'

# Add URL button
$c = $c -replace 'text-sm font-medium text-cyan-600 bg-cyan-50 hover:bg-cyan-100', 'text-sm font-medium text-brand-400 bg-brand-500/10 hover:bg-brand-500/20'

# Input fields
$c = $c -replace 'border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500 transition', 'border border-white/[0.08] rounded-xl bg-[#010409] text-white/70 placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500/40 transition'

# Scan button
$c = $c -replace 'bg-cyan-600 text-white rounded-xl hover:bg-cyan-700', 'bg-gradient-to-r from-brand-500 to-amber-600 text-white rounded-xl hover:from-brand-600 hover:to-amber-700'

# Delete button
$c = $c -replace 'text-gray-400 hover:text-red-500 hover:bg-red-50', 'text-white/30 hover:text-red-400 hover:bg-red-500/10'

# Scan All URLs button
$c = $c -replace 'border-2 border-dashed border-cyan-200 text-cyan-600 rounded-xl hover:bg-cyan-50 hover:border-cyan-300', 'border-2 border-dashed border-brand-500/30 text-brand-400 rounded-xl hover:bg-brand-500/5 hover:border-brand-500/50'

# Error box
$c = $c -replace 'bg-red-50 border border-red-200 rounded-xl text-red-600', 'bg-red-500/10 border border-red-500/20 rounded-xl text-red-400'

# Stats cards
$c = $c -replace 'bg-white rounded-xl p-4 shadow border border-gray-200', 'rounded-xl p-4 border border-white/[0.08] bg-[#0d1117]'
$c = $c -replace 'p-2 bg-cyan-100 rounded-lg', 'p-2 bg-brand-500/15 rounded-lg'
$c = $c -replace 'p-2 bg-indigo-100 rounded-lg', 'p-2 bg-indigo-500/15 rounded-lg'
$c = $c -replace 'p-2 bg-purple-100 rounded-lg', 'p-2 bg-purple-500/15 rounded-lg'
$c = $c -replace 'p-2 bg-green-100 rounded-lg', 'p-2 bg-emerald-500/15 rounded-lg'

# Stats values and labels
$c = $c -replace 'text-2xl font-bold text-gray-900', 'text-2xl font-bold text-white'

# Tab container
$c = $c -replace 'bg-white rounded-2xl shadow-lg border border-gray-200 mb-6 overflow-hidden', 'rounded-2xl border border-white/[0.08] bg-[#0d1117] mb-6 overflow-hidden'
$c = $c -replace 'flex border-b border-gray-200 overflow-x-auto', 'flex border-b border-white/[0.08] overflow-x-auto'

# Active/inactive tabs
$c = $c -replace "text-cyan-600 border-b-2 border-cyan-600 bg-cyan-50/50", "text-brand-400 border-b-2 border-brand-500 bg-brand-500/10"
$c = $c -replace "text-gray-500 hover:text-gray-700 hover:bg-gray-50", "text-white/40 hover:text-white/70 hover:bg-white/[0.04]"

# AI analyze button
$c = $c -replace 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl hover:from-cyan-700 hover:to-blue-700', 'bg-gradient-to-r from-brand-500 to-amber-600 text-white rounded-xl hover:from-brand-600 hover:to-amber-700'

# Result items
$c = $c -replace 'border border-gray-200 rounded-xl overflow-hidden', 'border border-white/[0.08] rounded-xl overflow-hidden'
$c = $c -replace 'bg-gray-50 cursor-pointer hover:bg-gray-100', 'bg-white/[0.03] cursor-pointer hover:bg-white/[0.06]'

# Remaining gray text
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
$c = $c -replace 'bg-gray-900', 'bg-[#010409]'

# Border gray remaining
$c = $c -replace 'border-gray-200', 'border-white/[0.08]'
$c = $c -replace 'border-gray-100', 'border-white/[0.06]'
$c = $c -replace 'border-gray-300', 'border-white/[0.10]'

# Schema type badge colors - convert light bgs to dark equivalents
$c = $c -replace "bg-blue-100 text-blue-700", "bg-blue-500/15 text-blue-300"
$c = $c -replace "bg-green-100 text-green-700", "bg-green-500/15 text-green-300"
$c = $c -replace "bg-purple-100 text-purple-700", "bg-purple-500/15 text-purple-300"
$c = $c -replace "bg-orange-100 text-orange-700", "bg-orange-500/15 text-orange-300"
$c = $c -replace "bg-cyan-100 text-cyan-700", "bg-cyan-500/15 text-cyan-300"
$c = $c -replace "bg-teal-100 text-teal-700", "bg-teal-500/15 text-teal-300"
$c = $c -replace "bg-sky-100 text-sky-700", "bg-sky-500/15 text-sky-300"
$c = $c -replace "bg-pink-100 text-pink-700", "bg-pink-500/15 text-pink-300"
$c = $c -replace "bg-indigo-100 text-indigo-700", "bg-indigo-500/15 text-indigo-300"
$c = $c -replace "bg-slate-100 text-slate-700", "bg-slate-500/15 text-slate-300"
$c = $c -replace "bg-amber-100 text-amber-700", "bg-amber-500/15 text-amber-300"
$c = $c -replace "bg-yellow-100 text-yellow-700", "bg-yellow-500/15 text-yellow-300"
$c = $c -replace "bg-emerald-100 text-emerald-700", "bg-emerald-500/15 text-emerald-300"
$c = $c -replace "bg-rose-100 text-rose-700", "bg-rose-500/15 text-rose-300"
$c = $c -replace "bg-violet-100 text-violet-700", "bg-violet-500/15 text-violet-300"
$c = $c -replace "bg-red-100 text-red-700", "bg-red-500/15 text-red-300"
$c = $c -replace "bg-lime-100 text-lime-700", "bg-lime-500/15 text-lime-300"
$c = $c -replace "bg-fuchsia-100 text-fuchsia-700", "bg-fuchsia-500/15 text-fuchsia-300"

# Remaining light backgrounds for cards/blocks
$c = $c -replace 'hover:bg-red-50', 'hover:bg-red-500/10'
$c = $c -replace 'hover:bg-cyan-50', 'hover:bg-brand-500/10'
$c = $c -replace 'hover:bg-cyan-100', 'hover:bg-brand-500/20'
$c = $c -replace 'bg-cyan-50', 'bg-brand-500/10'

# Indigo/purple bg references
$c = $c -replace 'bg-indigo-100', 'bg-indigo-500/15'
$c = $c -replace 'bg-purple-100', 'bg-purple-500/15'
$c = $c -replace 'bg-green-100', 'bg-green-500/15'
$c = $c -replace 'bg-cyan-100', 'bg-cyan-500/15'

$c = $c -replace 'text-indigo-600', 'text-indigo-400'
$c = $c -replace 'text-purple-600', 'text-purple-400'
$c = $c -replace 'text-green-600', 'text-green-400'

Set-Content $f $c -NoNewline
Write-Host "CompetitorSchemaChecker.jsx updated successfully"
