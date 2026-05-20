const fs = require('fs');

const pageFile = 'app/admin/vouchers/page.tsx';
let content = fs.readFileSync(pageFile, 'utf8');

// 1. Add new state variables
const stateHookTarget = `const [uploading, setUploading] = useState(false)`;
const stateHookReplacement = `const [uploading, setUploading] = useState(false)
    const [pasteText, setPasteText] = useState('')
    const [uploadMode, setUploadMode] = useState<'file'|'text'>('file')`;
content = content.replace(stateHookTarget, stateHookReplacement);

// 2. Add File Download icon
content = content.replace("Plus, Upload, RefreshCw, Loader2, Pencil, AlertTriangle, Eye, Wrench, Package, ShoppingCart, DollarSign, Clock, TrendingUp", "Plus, Upload, RefreshCw, Loader2, Pencil, AlertTriangle, Eye, Wrench, Package, ShoppingCart, DollarSign, Clock, TrendingUp, Download, FileText");

// 3. Replace handleUpload with new handlers
const handleUploadMatch = content.match(/const handleUpload = async[\s\S]*?finally \{ setUploading\(false\) \}\s*\n\s*\}/);

if (handleUploadMatch) {
    const newHandlers = `
    const processUpload = async (vouchers: any[]) => {
        if (!uploadTypeId) { toast.error('Select a voucher type'); return }
        if (vouchers.length === 0) { toast.error('No valid vouchers found'); return }
        setUploading(true)
        try {
            const res = await fetch('/api/admin/vouchers/upload', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ typeId: uploadTypeId, vouchers }) 
            })
            const json = await res.json()
            if (res.ok) { 
                toast.success(json.message || 'Upload successful'); 
                setUploadFile(null); 
                setPasteText('');
                fetchTypes(); 
                fetchStats(); 
            } else toast.error(json.error || 'Upload failed')
        } finally { setUploading(false) }
    }

    const handleFileUpload = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!uploadFile) { toast.error('Select a file'); return }
        const reader = new FileReader()
        reader.onload = async (ev) => {
            try {
                const data = ev.target?.result
                const xlsx = await import('xlsx')
                const workbook = xlsx.read(data, { type: 'binary' })
                const sheet = workbook.Sheets[workbook.SheetNames[0]]
                const jsonData = xlsx.utils.sheet_to_json(sheet, { header: 1 })
                
                const parsedVouchers = []
                for (let i = 0; i < jsonData.length; i++) {
                    const row: any = jsonData[i]
                    if (!row || row.length === 0) continue
                    const pinStr = String(row[0] || '').trim()
                    if (!pinStr || pinStr.toLowerCase() === 'pin') continue
                    const serialStr = row.length > 1 ? String(row[1] || '').trim() : ''
                    parsedVouchers.push({ pin: pinStr, serial_number: serialStr !== 'serial_number' ? serialStr : '' })
                }
                processUpload(parsedVouchers)
            } catch (err) { toast.error('Failed to parse file. Make sure it is a valid CSV or Excel file.') }
        }
        reader.readAsBinaryString(uploadFile)
    }

    const handleTextUpload = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!pasteText.trim()) { toast.error('Paste some text first'); return }
        const lines = pasteText.split('\\n')
        const parsedVouchers = []
        for (const line of lines) {
            const cleanLine = line.trim()
            if (!cleanLine) continue
            const parts = cleanLine.split(/[\\t,]+/)
            let pin = parts[0].trim()
            let serial = parts.length > 1 ? parts[1].trim() : ''
            if (parts.length === 1 && cleanLine.includes(' ')) {
                const spaceParts = cleanLine.split(/\\s+/)
                pin = spaceParts[0]; serial = spaceParts.length > 1 ? spaceParts[1] : ''
            }
            if (pin.toLowerCase() !== 'pin') parsedVouchers.push({ pin, serial_number: serial !== 'serial_number' ? serial : '' })
        }
        processUpload(parsedVouchers)
    }

    const downloadTemplate = (type: 'csv' | 'xlsx') => {
        import('xlsx').then(xlsx => {
            const ws = xlsx.utils.json_to_sheet([{ pin: '123456789012', serial_number: 'SN123456' }])
            const wb = xlsx.utils.book_new(); xlsx.utils.book_append_sheet(wb, ws, "Template")
            xlsx.writeFile(wb, \`voucher_template.\${type}\`)
        })
    }`;
    content = content.replace(handleUploadMatch[0], newHandlers);
}

// 4. Replace Inventory Tab UI
const inventoryTabRegex = /<TabsContent value="inventory" className="space-y-4">[\s\S]*?<h2 className="text-lg font-semibold mt-6">Stock Levels<\/h2>/;
const newInventoryTab = `<TabsContent value="inventory" className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold">Upload Inventory</h2>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => downloadTemplate('csv')}><Download className="w-4 h-4 mr-2"/>CSV Template</Button>
                            <Button variant="outline" size="sm" onClick={() => downloadTemplate('xlsx')}><Download className="w-4 h-4 mr-2"/>Excel Template</Button>
                        </div>
                    </div>
                    
                    <Card className="border-border/50">
                        <CardHeader className="pb-2 border-b border-border/30 mb-4">
                            <div className="flex gap-4">
                                <button type="button" onClick={() => setUploadMode('file')} className={\`pb-2 text-sm font-semibold \${uploadMode === 'file' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}\`}>File Upload (CSV/Excel)</button>
                                <button type="button" onClick={() => setUploadMode('text')} className={\`pb-2 text-sm font-semibold \${uploadMode === 'text' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}\`}>Paste Text</button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="mb-4 space-y-1.5 max-w-md">
                                <Label>Voucher Type <span className="text-red-500">*</span></Label>
                                <Select value={uploadTypeId} onValueChange={setUploadTypeId}>
                                    <SelectTrigger><SelectValue placeholder="Select type to upload into..." /></SelectTrigger>
                                    <SelectContent>
                                        {types.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            
                            {uploadMode === 'file' ? (
                                <form onSubmit={handleFileUpload} className="space-y-4">
                                    <div className="space-y-1.5">
                                        <Label>Select File (.csv, .xlsx, .xls)</Label>
                                        <Input type="file" accept=".csv,.xlsx,.xls" onChange={e => setUploadFile(e.target.files?.[0] || null)} className="max-w-md file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:bg-primary/10 file:text-primary cursor-pointer" />
                                        {uploadFile && <p className="text-xs text-muted-foreground mt-1">Selected: {uploadFile.name} ({(uploadFile.size / 1024).toFixed(1)} KB)</p>}
                                    </div>
                                    <Button type="submit" disabled={uploading || !uploadFile || !uploadTypeId}>
                                        {uploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</> : <><Upload className="w-4 h-4 mr-2" />Upload File</>}
                                    </Button>
                                </form>
                            ) : (
                                <form onSubmit={handleTextUpload} className="space-y-4">
                                    <div className="space-y-1.5">
                                        <Label>Paste PINs and Serials</Label>
                                        <p className="text-xs text-muted-foreground mb-2">Format: \`PIN,SerialNumber\` or \`PIN\` per line. Separated by comma, tab, or space.</p>
                                        <textarea 
                                            value={pasteText} 
                                            onChange={e => setPasteText(e.target.value)} 
                                            className="flex min-h-[200px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 font-mono"
                                            placeholder="123456789012,SN001&#10;987654321098,SN002&#10;555555555555"
                                        />
                                    </div>
                                    <Button type="submit" disabled={uploading || !pasteText.trim() || !uploadTypeId}>
                                        {uploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</> : <><FileText className="w-4 h-4 mr-2" />Process Text</>}
                                    </Button>
                                </form>
                            )}
                        </CardContent>
                    </Card>

                    <h2 className="text-lg font-semibold mt-6">Stock Levels</h2>`;
                    
content = content.replace(inventoryTabRegex, newInventoryTab);

fs.writeFileSync(pageFile, content, 'utf8');
console.log('UI updated successfully');
