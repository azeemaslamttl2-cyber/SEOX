$f = 'c:\Users\aleem\OneDrive\Documents\GitHub\seox\src\semanticsx\components\ImageGeoTagger.jsx'
$c = Get-Content $f -Raw

# Page wrapper
$c = $c -replace 'flex flex-col h-full bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 overflow-hidden', 'flex flex-col h-full overflow-hidden'

# Hero header
$c = $c -replace 'bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 rounded-2xl p-6 text-white mb-6 shadow-xl', 'bg-gradient-to-r from-brand-500 via-amber-500 to-amber-600 rounded-2xl p-6 text-white mb-6 shadow-xl'
$c = $c -replace 'text-emerald-200', 'text-white/70'

# Clear All button
$c = $c -replace 'bg-white/10 hover:bg-white/20 border border-white/20', 'bg-white/15 hover:bg-white/25 border border-white/20'

# GPS Coordinates card
$c = $c -replace 'bg-white rounded-2xl border border-gray-200 p-6 shadow-sm', 'rounded-2xl border border-white/[0.08] bg-[#0d1117] p-6'

# Section headers
$c = $c -replace 'text-lg font-semibold text-gray-900 mb-4', 'text-lg font-semibold text-white/90 mb-4'

# Icon accents
$c = $c -replace 'text-teal-600', 'text-brand-400'
$c = $c -replace 'text-teal-700', 'text-brand-300'
$c = $c -replace 'text-teal-500', 'text-brand-400'
$c = $c -replace 'text-teal-800', 'text-brand-200'

# Form labels
$c = $c -replace 'block text-sm font-medium text-gray-700 mb-1', 'block text-sm font-medium text-white/60 mb-1'

# Input fields
$c = $c -replace 'w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent', 'w-full px-4 py-2 border border-white/[0.08] rounded-lg bg-[#010409] text-white/70 placeholder:text-white/20 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500/40'
$c = $c -replace 'w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent', 'w-full px-4 py-2 border border-white/[0.08] rounded-lg bg-[#010409] text-white/70 placeholder:text-white/20 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500/40'
$c = $c -replace 'w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm', 'w-full pl-10 pr-4 py-2 border border-white/[0.08] rounded-lg bg-[#010409] text-white/70 placeholder:text-white/20 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500/40 text-sm'

# Map toggle button
$c = $c -replace 'w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition', 'w-full flex items-center justify-center gap-2 px-4 py-2 bg-white/[0.06] hover:bg-white/[0.10] rounded-lg text-sm font-medium text-white/60 transition'

# Current location button
$c = $c -replace 'px-3 py-2 bg-teal-100 hover:bg-teal-200 text-teal-700 rounded-lg transition', 'px-3 py-2 bg-brand-500/15 hover:bg-brand-500/25 text-brand-300 rounded-lg transition'

# Search dropdown
$c = $c -replace 'absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto', 'absolute z-50 w-full mt-1 bg-[#0d1117] border border-white/[0.12] rounded-lg shadow-lg max-h-60 overflow-auto'
$c = $c -replace 'w-full px-4 py-3 text-left hover:bg-teal-50 border-b border-gray-100 last:border-0 transition', 'w-full px-4 py-3 text-left hover:bg-brand-500/10 border-b border-white/[0.06] last:border-0 transition'

# Map container border
$c = $c -replace 'h-72 rounded-lg border border-gray-200 overflow-hidden', 'h-72 rounded-lg border border-white/[0.08] overflow-hidden'

# Selected address
$c = $c -replace 'p-3 bg-teal-50 border border-teal-200 rounded-lg', 'p-3 bg-brand-500/[0.06] border border-brand-500/20 rounded-lg'

# Apply GPS button
$c = $c -replace 'w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-teal-600 to-cyan-600 text-white rounded-lg font-medium hover:shadow-lg transition disabled:opacity-50', 'w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-brand-500 to-amber-600 text-white rounded-lg font-medium hover:shadow-lg transition disabled:opacity-50'

# Statistics card
$c = $c -replace 'text-lg font-semibold text-gray-900', 'text-lg font-semibold text-white/90'

# Stat tiles
$c = $c -replace 'text-center p-4 bg-gray-50 rounded-xl', 'text-center p-4 bg-white/[0.03] rounded-xl'
$c = $c -replace 'text-center p-4 bg-green-50 rounded-xl', 'text-center p-4 bg-emerald-500/[0.06] rounded-xl'
$c = $c -replace 'text-center p-4 bg-blue-50 rounded-xl', 'text-center p-4 bg-blue-500/[0.06] rounded-xl'
$c = $c -replace 'text-center p-4 bg-purple-50 rounded-xl', 'text-center p-4 bg-purple-500/[0.06] rounded-xl'

# Info box
$c = $c -replace 'bg-blue-50 rounded-xl border border-blue-200 p-4', 'bg-brand-500/[0.06] rounded-xl border border-brand-500/20 p-4'
$c = $c -replace 'text-blue-600', 'text-brand-400'
$c = $c -replace 'text-blue-800', 'text-brand-200'
$c = $c -replace 'text-blue-700', 'text-brand-300'

# Upload zone
$c = $c -replace 'bg-white border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center cursor-pointer hover:border-teal-500 hover:bg-teal-50/30 transition', 'bg-white/[0.02] border-2 border-dashed border-white/[0.10] rounded-2xl p-8 text-center cursor-pointer hover:border-brand-500/40 hover:bg-brand-500/[0.04] transition'

# Select/Deselect All buttons
$c = $c -replace 'px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition', 'px-3 py-1.5 bg-white/[0.06] hover:bg-white/[0.10] rounded-lg text-sm font-medium text-white/60 transition'

# Download All button
$c = $c -replace 'bg-green-600 text-white rounded-lg font-medium hover:bg-green-700', 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg font-medium hover:from-emerald-600 hover:to-emerald-700'

# Image cards
$c = $c -replace "border-teal-500 ring-2 ring-teal-500/30", "border-brand-500 ring-2 ring-brand-500/30"
$c = $c -replace "border-gray-200 hover:border-gray-300", "border-white/[0.08] hover:border-white/[0.15]"

# Image card bg
$c = $c -replace 'relative bg-white rounded-xl border-2', 'relative bg-[#0d1117] rounded-xl border-2'
$c = $c -replace 'aspect-square bg-gray-100 relative', 'aspect-square bg-white/[0.03] relative'

# Selection circle
$c = $c -replace 'bg-teal-500 text-white', 'bg-brand-500 text-white'

# Download single image button
$c = $c -replace 'bg-teal-100 text-teal-700 rounded-lg text-sm font-medium hover:bg-teal-200', 'bg-brand-500/15 text-brand-300 rounded-lg text-sm font-medium hover:bg-brand-500/25'

# Remaining gray text
$c = $c -replace 'text-gray-900', 'text-white/90'
$c = $c -replace 'text-gray-800', 'text-white/80'
$c = $c -replace 'text-gray-700', 'text-white/60'
$c = $c -replace 'text-gray-600', 'text-white/50'
$c = $c -replace 'text-gray-500', 'text-white/40'
$c = $c -replace 'text-gray-400', 'text-white/30'
$c = $c -replace 'text-gray-300', 'text-white/20'
$c = $c -replace 'text-gray-100', 'text-white/10'

# Remaining bg-gray
$c = $c -replace 'bg-gray-100', 'bg-white/[0.06]'
$c = $c -replace 'bg-gray-50', 'bg-white/[0.03]'

# Remaining border-gray
$c = $c -replace 'border-gray-200', 'border-white/[0.08]'
$c = $c -replace 'border-gray-100', 'border-white/[0.06]'
$c = $c -replace 'border-gray-300', 'border-white/[0.10]'

# Update green-600 stat text (should stay green for geo-tagged status)
$c = $c -replace 'text-green-600', 'text-emerald-400'
$c = $c -replace 'text-purple-600', 'text-purple-400'

Set-Content $f $c -NoNewline
Write-Host "ImageGeoTagger.jsx updated successfully"
