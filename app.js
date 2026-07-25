const SECRET_KEY = "Secjgd123#$13";
let globalData = {};
let historyData = {};
let currentDataSource = 'current'; // 'current' or 'history'

async function loadEncryptedData(filename) {
    const response = await fetch(filename);
    const encryptedText = await response.text();
    const decrypted = CryptoJS.AES.decrypt(encryptedText, SECRET_KEY);
    return JSON.parse(decrypted.toString(CryptoJS.enc.Utf8));
}

async function loadDashboard() {
    // Load both current and history data
    const [currentRaw, historyRaw] = await Promise.all([
        loadEncryptedData('data.enc'),
        loadEncryptedData('data_history.enc')
    ]);
    
    globalData = currentRaw.districts;
    historyData = historyRaw.districts;
    
    // Update the UI with the date
    const lastUpdated = currentRaw.metadata.last_updated;
    document.getElementById('last-updated-text').innerText = `Data Last Updated at: ${lastUpdated}`;
    
    // Set default sort to top performing
    document.getElementById('sortTopCheck').checked = true;
    
    // Set default filter to entry level
    document.getElementById('btn-all').className = 'btn btn-outline-primary';
    document.getElementById('btn-entry').className = 'btn btn-primary';
    
    // Populate course filter dropdown
    const courseSelect = document.getElementById('courseTypeFilter');
    if (courseSelect) {
        courseSelect.innerHTML = '<option value="">All Course Types</option>';
        FILTER_COURSES.forEach(course => {
            courseSelect.innerHTML += `<option value="${course}">${course}</option>`;
        });
    }
    
    renderCards();
}

function getStatus(startStr, endStr) {
    const today = new Date();
    today.setHours(0,0,0,0); // Focus on date only
    const start = new Date(startStr);
    const end = new Date(endStr);

    if (today < start) return { label: "Upcoming", class: "table-info", showBtn: true };
    if (today >= start && today <= end) return { label: "Active", class: "table-success", showBtn: false };
    return { label: "Completed", class: "table-secondary", showBtn: false };
}

let currentFilter = 'entry'; 
let isSortingTop = true;

function setFilter(type) {
    currentFilter = type;
    // Update button UI
    document.getElementById('btn-all').className = `btn ${type === 'all' ? 'btn-primary' : 'btn-outline-primary'}`;
    document.getElementById('btn-entry').className = `btn ${type === 'entry' ? 'btn-primary' : 'btn-outline-primary'}`;
    renderCards();
}

function setCourseFilter(courseType) {
    selectedCourseType = courseType;
    renderCards();
}

function toggleSort() {
    isSortingTop = document.getElementById('sortTopCheck').checked;
    renderCards();
}

// Define the Entry Level List
const ENTRY_LEVEL_COURSES = [
    "Happiness Program", 
    "Sahaj Samadhi Dhyana Yoga", 
    "Rural Happiness Program", 
    "Happiness Program for Youth-3 Days",
    "Happiness Program For Youth",
    "Online Meditation and Breath Workshop", 
    "YES!+", 
    "Happiness Program (3 Days)", 
    "YLTP", 
    "Utkarsha Yoga", 
    "Medha Yoga Level 1"
];

// Define filterable courses for dropdown
const FILTER_COURSES = [
    "Happiness Program",
    "Sahaj Samadhi Dhyana Yoga",
    "YES!+",
    "YLTP"
];

// Course mapping - maps UI selection to actual course type(s)
const COURSE_TYPE_MAPPING = {
    "Happiness Program": ["Happiness Program", "Rural Happiness Program", "Happiness Program (3 Days)", "Happiness Program for Youth-3 Days", "Happiness Program For Youth"],
    "Sahaj Samadhi Dhyana Yoga": ["Sahaj Samadhi Dhyana Yoga"],
    "YES!+": ["YES!+"],
    "YLTP": ["YLTP"]
};

let selectedCourseType = null; // null means no specific course filter

function getMedalIcon(index) {
    if (!isSortingTop) return "";
    
    // Size and color configuration
    const style = "font-size: 1.8rem; display: block; margin-bottom: 5px;";
    
    if (index === 0) return `<i class="bi bi-trophy-fill" style="${style} color: #FFD700;"></i>`; // Gold
    if (index === 1) return `<i class="bi bi-award-fill" style="${style} color: #C0C0C0;"></i>`;  // Silver
    if (index === 2) return `<i class="bi bi-award-fill" style="${style} color: #CD7F32;"></i>`;  // Bronze
    return "";
}

function filterData(filterType) {
    currentFilter = filterType;
    
    // Update button active states
    document.querySelectorAll('.btn-group .btn').forEach(btn => btn.classList.remove('active'));
    if(filterType === 'all') document.getElementById('btn-all').classList.add('active');
    if(filterType === 'top') document.getElementById('btn-top').classList.add('active');
    if(filterType === 'entry') document.getElementById('btn-entry').classList.add('active');

    renderCards();
}

function renderCards() {
    const container = document.getElementById('dashboard-container');
    container.innerHTML = "";
    const activeData = getActiveData();

    // 1. Create a workable copy of the data
    let displayList = Object.keys(activeData).map(name => {
        let dist = JSON.parse(JSON.stringify(activeData[name])); 
        
        if (currentFilter === 'entry') {
            dist.courses = dist.courses.filter(c => ENTRY_LEVEL_COURSES.includes(c['Course Type']));
            // Re-calculate pax based on entry level ONLY
            dist.total_pax = dist.courses.reduce((sum, c) => sum + (parseInt(c['Registered Pax Count']) || 0), 0);
        }
        
        // Apply specific course type filter if selected
        if (selectedCourseType && COURSE_TYPE_MAPPING[selectedCourseType]) {
            const allowedTypes = COURSE_TYPE_MAPPING[selectedCourseType];
            dist.courses = dist.courses.filter(c => allowedTypes.includes(c['Course Type']));
            // Re-calculate pax based on selected course type
            dist.total_pax = dist.courses.reduce((sum, c) => sum + (parseInt(c['Registered Pax Count']) || 0), 0);
        }
        
        return { name, ...dist };
    });

    // 3. Apply Sorting
    if (isSortingTop) {
        // Sort by registrations (descending)
        displayList.sort((a, b) => b.total_pax - a.total_pax);
    } else {
        // Sort by name (alphabetical)
        displayList.sort((a, b) => a.name.localeCompare(b.name));
    }

    // 4. Render the filtered/sorted cards
    displayList.forEach((dist, index) => {
        const stats = { Upcoming: 0, Active: 0, Completed: 0 };
        // New counters for the Pie Chart
        let entryCount = 0;
        let advancedCount = 0;
        let activeRegistrations = 0;

        dist.courses.forEach(c => {
            const status = getStatus(c['Start Date'], c['End Date']);
            stats[status.label]++;

            const pax = parseInt(c['Registered Pax Count']) || 0;

            // Track registrations specifically for Active programs
            if (status.label === "Active") {
                activeRegistrations += pax;
            }
            
            // Calculate Mix
            if (ENTRY_LEVEL_COURSES.includes(c['Course Type'])) {
                entryCount++;
            } else {
                advancedCount++;
            }
        });

        // --- NEW MULTI-FACTOR COLOR LOGIC ---
        let statusClass = "bg-danger text-white"; 
        let textColor = "text-white";

        // Condition for GREEN
        if (stats.Upcoming >= 2 || (stats.Active > 0 && activeRegistrations > 5)) {
            statusClass = "bg-success text-white";
        } 
        // Condition for YELLOW
        else if (stats.Upcoming === 1 || (stats.Active > 0 && activeRegistrations > 0)) {
            statusClass = "bg-warning text-dark";
            textColor = "text-dark";
        }

        // ---- NEW: PIE CHART GENERATION ----
        let chartHtml = '';
        const totalMix = entryCount + advancedCount;
        // Only show chart if not in 'entry' filter mode AND there is data
        if (currentFilter !== 'entry' && totalMix > 0) {
            const entryPercent = (entryCount / totalMix) * 100;
            // Colors used for the slices
            const colEntry = currentFilter === 'all' || currentFilter === 'top' ? '#00d2ff' : '#007bff'; // Cyan for Entry
            const colAdv = currentFilter === 'all' || currentFilter === 'top' ? '#ffc107' : '#6c757d';  // Yellow/Gold for Adv

            chartHtml = `
            <div class="pie-chart-container d-flex align-items-center justify-content-center">
                 <div class="pie-chart mr-3" style="background: conic-gradient(${colEntry} 0% ${entryPercent}%, ${colAdv} ${entryPercent}% 100%);"></div>
                <div class="text-left chart-legend ${textColor}">
                    <div><span style="color:${colEntry}">■</span> Entry: <strong>${entryCount}</strong></div>
                    <div><span style="color:${colAdv}">■</span> Other: <strong>${advancedCount}</strong></div>
                </div>
            </div>
            `;
        }

        const medalIcon = getMedalIcon(index);

        const cardHtml = `
            <div class="col-12 col-lg-3 mb-4" onclick="showDetails('${dist.name}')">
                <div class="card h-100 shadow-sm border-0 ${statusClass}">
                    <div class="card-header border-light bg-transparent text-center font-weight-bold pt-3">
                        ${medalIcon}
                        <span style="font-size: 1.2rem;">${dist.name}</span>
                    </div>
                    <div class="card-body">
                        <div class="d-flex justify-content-around text-center">
                            <div><h4 class="mb-0 font-weight-bold">${stats.Upcoming}</h4><small>Upcoming</small></div>
                            <div><h4 class="mb-0">${stats.Active}</h4><small>Active</small></div>
                            <div><h4 class="mb-0">${stats.Completed}</h4><small>Done</small></div>
                        </div>
                        
                        ${chartHtml}

                        <hr class="border-light opacity-50">
                        <div class="text-center small">
                            <div><strong>${dist.total_pax}</strong> Total Pax</div>
                                ${stats.Active > 0 ? `<div class="mt-1 font-italic opacity-75">(${activeRegistrations} in Active Programs)</div>` : ''}
                        </div>
                    </div>
                </div>
            </div>`;
        container.innerHTML += cardHtml;
    });
}

// Helper to fix the relative link issue
function formatUrl(url) {
    if (!url) return "#";
    const trimmed = url.trim();
    // If it already starts with http, return as is. 
    // Otherwise, prepend https://
    return (trimmed.startsWith('http')) ? trimmed : `https://${trimmed}`;
}

// Helper to clean phone numbers for links
function cleanPhone(phone) {
    if (!phone) return "";
    return phone.replace(/\D/g, ''); // Removes everything except digits
}

function showDetails(distName) {
    const activeData = getActiveData();
    const dist = activeData[distName];
    const tableBody = document.getElementById('detail-table-body');
    document.getElementById('detail-title').innerText = `${distName} Program Schedule`;
    tableBody.innerHTML = "";
    
    if (!dist.courses || dist.courses.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">No programs currently scheduled for this district.</td></tr>`;
    } else {
        const statusOrder = { "Upcoming": 0, "Active": 1, "Completed": 2 };
        const sortedCourses = [...dist.courses].sort((a, b) => {
            const statusA = getStatus(a['Start Date'], a['End Date']).label;
            const statusB = getStatus(b['Start Date'], b['End Date']).label;
            if (statusOrder[statusA] !== statusOrder[statusB]) {
                return statusOrder[statusA] - statusOrder[statusB];
            }
            // Completed: descending; Upcoming/Active: ascending
            const dateOrder = new Date(a['Start Date']) - new Date(b['Start Date']);
            return statusA === "Completed" ? -dateOrder : dateOrder;
        });
        sortedCourses.forEach(c => {
        const status = getStatus(c['Start Date'], c['End Date']);
        const cleanUrl = formatUrl(c['Registration Url']);
        const phone = cleanPhone(c['Phone']);
        const teacherDisplay = cleanTeacherNames(c['Teachers']);
        
        // Generate WhatsApp and Call icons if a phone number exists
        const contactActions = phone ? `
            <div class="mt-1">
                <a href="tel:${phone}" class="btn btn-sm btn-outline-secondary mr-1" title="Call Teacher">
                    📞
                </a>
                <a href="https://wa.me/91${phone}" target="_blank" class="btn btn-sm btn-outline-success" title="WhatsApp Teacher">
                    💬
                </a>
            </div>
        ` : '<small class="text-muted">No phone</small>';

        tableBody.innerHTML += `
            <tr class="${status.class}">
                <td><strong>${status.label}</strong></td>
                <td>${c['Course Type']}</td>
                <td>${c['Registered Pax Count']}</td>
                <td>
                    ${teacherDisplay}
                    ${contactActions}
                </td>
                <td>${c['Start Date']}</td>
                <td>
                    ${status.showBtn ? `<a href="${cleanUrl}" target="_blank" class="btn btn-sm btn-primary">Register</a>` : '-'}
                </td>
            </tr>`;
        });
    }
    
    document.getElementById('detail-view').style.display = 'block';
    window.scrollTo({ top: document.getElementById('detail-view').offsetTop - 20, behavior: 'smooth' });
}

// Helper to strip teacher codes like (KR1450)
function cleanTeacherNames(names) {
    if (!names) return "";
    // Removes text inside parentheses and the parentheses themselves
    return names.replace(/\s*\([^)]*\)/g, "");
}

function showView(viewType) {
    const dashboard = document.getElementById('dashboard-container');
    const summary = document.getElementById('state-summary-container');
    const controls = document.getElementById('filter-controls');
    const detailView = document.getElementById('detail-view');

    if (viewType === 'state') {
        dashboard.style.display = 'none';
        controls.style.display = 'none'; // Hide filters in state view
        summary.style.display = 'block';
        detailView.style.display = 'none'; // Ensure detail view is hidden
        document.getElementById('state_label').className = 'btn btn-warning';
        document.getElementById('district_label').className = 'btn btn-outline-warning';
        renderStateSummary();
    } else {
        dashboard.style.display = 'flex';
        controls.style.display = 'block';
        summary.style.display = 'none';
        detailView.style.display = 'block'; // Ensure detail view is visible
        document.getElementById('state_label').className = 'btn btn-outline-warning';
        document.getElementById('district_label').className = 'btn btn-warning';
        renderCards();
    }
}

function switchDataSource(source) {
    currentDataSource = source;
    
    // Update button UI
    document.getElementById('btn-current').className = `btn ${source === 'current' ? 'btn-info' : 'btn-outline-info'}`;
    document.getElementById('btn-history').className = `btn ${source === 'history' ? 'btn-info' : 'btn-outline-info'}`;
    
    // Update date range display
    const dateRange = document.getElementById('date-range');
    if (dateRange) {
        dateRange.innerText = source === 'current' ? '(Jun 1, 2026 onwards)' : '(Jan 15, 2026 to May 31, 2026)';
    }
    
    renderCards();
}

function getActiveData() {
    return currentDataSource === 'history' ? historyData : globalData;
}

function renderStateSummary() {
    const container = document.getElementById('state-summary-container');
    
    let totalStats = { Upcoming: 0, Active: 0, Completed: 0 };
    let totalPax = { entry: 0, other: 0 };
    let districtMetrics = [];

    const activeData = getActiveData();
    Object.keys(activeData).forEach(name => {
        const dist = activeData[name];
        
        // Use a Set to track unique Course IDs for this district
        let uniqueCourseIds = new Set();
        let distPax = 0;

        dist.courses.forEach(c => {
            const courseId = c['ID']; // Assuming 'ID' is the unique identifier
            const status = getStatus(c['Start Date'], c['End Date']);
            const pax = parseInt(c['Registered Pax Count']) || 0;

            // Only count status and uniqueness if we haven't seen this ID in this district yet
            if (!uniqueCourseIds.has(courseId)) {
                uniqueCourseIds.add(courseId);
                totalStats[status.label]++;
                
                // Categorize Pax
                if (ENTRY_LEVEL_COURSES.includes(c['Course Type'])) {
                    totalPax.entry += pax;
                } else {
                    totalPax.other += pax;
                }
            }
            
            // Note: We sum pax normally here, but if your CSV duplicates 
            // the same pax count across multiple rows for the same ID, 
            // you should move this inside the 'if' block above as well.
            distPax += pax; 
        });

        districtMetrics.push({ 
            name, 
            courses: uniqueCourseIds.size, // Use the count of unique IDs
            pax: distPax 
        });
    });

    // Sorting logic for Top 3
    const topByCourses = [...districtMetrics].sort((a, b) => b.courses - a.courses).slice(0, 3);
    const topByPax = [...districtMetrics].sort((a, b) => b.pax - a.pax).slice(0, 3);

    container.innerHTML = `
        <div class="row">
            <div class="col-md-6 mb-4">
                <div class="card shadow-sm border-primary h-100">
                    <div class="card-header bg-primary text-white font-weight-bold">Total Courses Portfolio</div>
                    <div class="card-body d-flex justify-content-around align-items-center text-center">
                        <div><h2 class="text-info">${totalStats.Upcoming}</h2><p>Upcoming</p></div>
                        <div><h2 class="text-success">${totalStats.Active}</h2><p>Active</p></div>
                        <div><h2 class="text-muted">${totalStats.Completed}</h2><p>Completed</p></div>
                    </div>
                </div>
            </div>
            <div class="col-md-6 mb-4">
                <div class="card shadow-sm border-success h-100">
                    <div class="card-header bg-success text-white font-weight-bold">Total Registrations</div>
                    <div class="card-body d-flex justify-content-around align-items-center text-center">
                        <div><h2 class="text-dark">${totalPax.entry}</h2><p>Entry Level</p></div>
                        <div><h2 class="text-dark">${totalPax.other}</h2><p>Other Programs</p></div>
                        <div class="border-left pl-3"><h2>${totalPax.entry + totalPax.other}</h2><p>Total</p></div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

document.addEventListener('DOMContentLoaded', loadDashboard);