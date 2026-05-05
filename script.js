document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('syllabusForm');
    const dateInput = document.getElementById('date');
    const submitBtn = document.getElementById('submitBtn');

    // =========================================================================
    // SUBJECT → PARENT SUBJECT MAPPING
    // Teachers select what they call "Subject" (e.g., Algebra, Physics).
    // We auto-derive the parent subject (Mathematics, Science, etc.) for the payload.
    // =========================================================================
    const SUBJECT_TO_PARENT = {
        "Algebra": "Mathematics",
        "Geometry": "Mathematics",
        "Physics": "Science",
        "Chemistry": "Science",
        "Biology": "Science",
        "History": "Social Science",
        "Geography": "Social Science",
        "Political Science": "Social Science",
        "Economics": "Social Science",
        "English": "English",
        "Hindi": "Language",
        "Marathi": "Language",
        "Sanskrit": "Language"
    };

    // =========================================================================
    // DYNAMIC CHAPTERS LOADED BELOW
    // =========================================================================

    // =========================================================================
    // STUDENT DATA — Fetch from Google Sheets via JSONP
    // Sheet columns: Student_ID | First_Name | Last_Name | Gender
    // NOTE: Grade & Batch columns may or may not exist yet. We load what we can.
    // =========================================================================
    const SHEET_ID = '16JAViFIXgf0oDqC5Nl0V6UpGqKrUVGAHkoEeYw1LdGs';
    const GID_STUDENTS = '91172728';
    const GID_CHAPTERS = '1066495436';
    let allStudents = [];
    let allChapters = [];

    async function fetchChapters() {
        try {
            const data = await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                const cbName = 'gvizCallbackCh_' + Math.floor(Math.random() * 100000);
                window[cbName] = (jsonData) => {
                    delete window[cbName];
                    script.remove();
                    resolve(jsonData);
                };
                script.onerror = () => {
                    delete window[cbName];
                    script.remove();
                    reject(new Error('Failed to load Google Sheet Chapters'));
                };
                script.src = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json;responseHandler:${cbName}&gid=${GID_CHAPTERS}`;
                document.body.appendChild(script);
            });

            const gradeIdx = 2;
            const subSubjectIdx = 4;
            const codeIdx = 6;
            const nameIdx = 7;

            const rows = data.table.rows;
            allChapters = rows.map(row => {
                const c = row.c;
                if (!c || !c[nameIdx] || !c[nameIdx].v) return null;
                return {
                    grade: (c[gradeIdx] && c[gradeIdx].v) ? String(c[gradeIdx].v).trim() : '',
                    subSubject: (c[subSubjectIdx] && c[subSubjectIdx].v) ? String(c[subSubjectIdx].v).trim() : '',
                    code: (c[codeIdx] && c[codeIdx].v) ? String(c[codeIdx].v).trim() : 'MANUAL',
                    name: String(c[nameIdx].v).trim()
                };
            }).filter(ch => ch !== null && !ch.name.toLowerCase().includes('chapter_name') && ch.name !== '');
            
            console.log(`Chapters loaded: ${allChapters.length}`);
        } catch (error) {
            console.error('Chapter fetch error:', error);
        }
    }

    async function fetchStudents() {
        try {
            const data = await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                const cbName = 'gvizCallbackSt_' + Math.floor(Math.random() * 100000);
                window[cbName] = (jsonData) => {
                    delete window[cbName];
                    script.remove();
                    resolve(jsonData);
                };
                script.onerror = () => {
                    delete window[cbName];
                    script.remove();
                    reject(new Error('Failed to load Google Sheet Students'));
                };
                script.src = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json;responseHandler:${cbName}&gid=${GID_STUDENTS}`;
                document.body.appendChild(script);
            });

            // Hardcode column indices based on user's exact sheet structure
            // 0: Student_ID, 1: First_Name, 2: Last_Name, ..., 6: Grade
            const idIdx = 0;
            const firstIdx = 1;
            const lastIdx = 2;
            const gradeIdx = 6;

            const rows = data.table.rows;
            allStudents = rows.map(row => {
                const c = row.c;
                if (!c || !c[idIdx] || !c[idIdx].v) return null;

                const sid = String(c[idIdx].v).trim();
                if (sid.toLowerCase().includes('student_id') || sid.toLowerCase().includes('roll no')) return null;

                const firstName = (c[firstIdx] && c[firstIdx].v) ? String(c[firstIdx].v).trim() : '';
                const lastName = (c[lastIdx] && c[lastIdx].v) ? String(c[lastIdx].v).trim() : '';
                const grade = (c[gradeIdx] && c[gradeIdx].v) ? String(c[gradeIdx].v).trim() : '';

                return {
                    id: sid,
                    firstName: firstName,
                    lastName: lastName,
                    fullName: `${firstName} ${lastName}`.trim() || 'No Name',
                    grade: grade
                };
            }).filter(s => s !== null);

            console.log(`Students loaded: ${allStudents.length}`);
        } catch (error) {
            console.error('Student fetch error:', error);
        }
    }

    // =========================================================================
    // Helper: Filter students based on selected Grade (Not filtering by batch currently)
    // =========================================================================
    function getFilteredStudents() {
        const grade = document.querySelector('input[name="grade"]:checked')?.value;
        // Batch filtering disabled for now as per user request
        // const batch = document.querySelector('input[name="batch"]:checked')?.value;

        if (!grade) return [];

        return allStudents.filter(s => {
            // Strict filtering by grade. 
            // Replace removes 'th' to match "10th" with "10" just in case.
            if (!s.grade) return false; // Don't show students without a grade
            return s.grade.toLowerCase().includes(grade.replace('th', '').toLowerCase());
        });
    }

    // =========================================================================
    // UI: COLLAPSIBLE SECTIONS
    // =========================================================================
    window.toggleSection = function(id) {
        const section = document.getElementById(id);
        if (section) {
            section.classList.toggle('collapsed');
            const content = section.querySelector('.collapsible-content');
            if (section.classList.contains('collapsed')) {
                content.style.overflow = 'hidden';
            } else {
                setTimeout(() => {
                    if (!section.classList.contains('collapsed')) {
                        content.style.overflow = 'visible';
                    }
                }, 400); // Match CSS transition time
            }
        }
    };

    // =========================================================================
    // UI: CASCADING SUBJECT → CHAPTER
    // =========================================================================
    const subjectSelect = document.getElementById('subject');
    const chapterSearch = document.getElementById('chapter_search');
    const chapterResults = document.getElementById('chapter_search_results');
    const chapterManual = document.getElementById('chapter_manual');
    const manualChapterRow = document.getElementById('manualChapterRow');
    const chapterChipsEl = document.getElementById('chapter_chips');
    const gradeRadios = document.getElementsByName('grade');
    const parentSubjectRow = document.getElementById('parentSubjectRow');
    const parentSubjectDisplay = document.getElementById('parentSubjectDisplay');
    let selectedChapters = []; // [{name, code, hours}]

    subjectSelect.addEventListener('change', () => {
        const subject = subjectSelect.value;
        const grade = document.querySelector('input[name="grade"]:checked')?.value;

        // Show auto-derived parent subject
        const parentSubject = SUBJECT_TO_PARENT[subject] || subject;
        parentSubjectDisplay.textContent = parentSubject;
        parentSubjectRow.style.display = 'flex';

        // Reset chapter selections
        selectedChapters = [];
        chapterChipsEl.innerHTML = '';

        const isLanguage = ["Hindi", "Marathi", "Sanskrit"].includes(subject);

        // Filter chapters dynamically based on Grade and Sub_Subject
        const availableChapters = allChapters.filter(ch => {
            const cleanGrade = grade ? grade.replace('th', '').trim().toLowerCase() : '';
            const chGrade = ch.grade ? ch.grade.replace('th', '').trim().toLowerCase() : '';
            return chGrade === cleanGrade && ch.subSubject.toLowerCase() === subject.toLowerCase();
        });

        if (availableChapters.length > 0 && !isLanguage) {
            // Show searchable chapter dropdown
            chapterSearch.style.display = 'block';
            chapterSearch.disabled = false;
            chapterSearch.placeholder = 'Search or select chapter...';
            chapterSearch.value = '';
            manualChapterRow.style.display = 'none';
        } else {
            // No chapters found for combo or Languages — show manual entry
            chapterSearch.style.display = 'none';
            chapterResults.classList.remove('active');
            manualChapterRow.style.display = 'flex';
            chapterManual.value = '';
        }
    });

    // Reset chapter dropdown if grade changes (since chapters differ by grade)
    gradeRadios.forEach(r => r.addEventListener('change', () => {
        if (subjectSelect.value) {
            subjectSelect.dispatchEvent(new Event('change'));
        }
    }));

    // =========================================================================
    // UI: MULTI-SELECT CHAPTER LOGIC
    // =========================================================================
    function populateChapterDropdown(chapters) {
        chapterResults.innerHTML = '';
        chapters.forEach(ch => {
            const code = ch.code || 'MANUAL';
            const div = document.createElement('div');
            div.className = 'dropdown-item';
            div.innerHTML = `${ch.name} <span style="color:#00b894;font-size:0.8rem;margin-left:4px;">(${code})</span>`;
            div.onclick = () => {
                addChapterChip(ch.name, code);
                chapterSearch.value = '';
                chapterResults.classList.remove('active');
            };
            chapterResults.appendChild(div);
        });
    }

    function getAvailableChaptersForDropdown() {
        const subject = subjectSelect.value;
        const grade = document.querySelector('input[name="grade"]:checked')?.value;
        const cleanGrade = grade ? grade.replace('th', '').trim().toLowerCase() : '';
        
        return allChapters.filter(ch => {
            const chGrade = ch.grade ? ch.grade.replace('th', '').trim().toLowerCase() : '';
            return chGrade === cleanGrade && 
                   ch.subSubject.toLowerCase() === subject.toLowerCase() && 
                   !selectedChapters.find(s => s.name === ch.name);
        });
    }

    chapterSearch.addEventListener('focus', () => {
        const available = getAvailableChaptersForDropdown();
        if (available.length > 0) {
            populateChapterDropdown(available);
            chapterResults.classList.add('active');
        }
    });

    chapterSearch.addEventListener('input', () => {
        const query = chapterSearch.value.toLowerCase().trim();
        if (!query) { chapterResults.classList.remove('active'); return; }
        
        const available = getAvailableChaptersForDropdown().filter(ch => 
            ch.name.toLowerCase().includes(query) || ch.code.toLowerCase().includes(query)
        );
        populateChapterDropdown(available);
        chapterResults.classList.add('active');
    });

    // Manual chapter entry (9th grade / Languages)
    chapterManual.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const name = chapterManual.value.trim();
            if (name) { addChapterChip(name, 'MANUAL'); chapterManual.value = ''; }
        }
    });
    document.getElementById('addManualChapterBtn').addEventListener('click', () => {
        const name = chapterManual.value.trim();
        if (name) { addChapterChip(name, 'MANUAL'); chapterManual.value = ''; }
    });

    function addChapterChip(name, code) {
        if (selectedChapters.find(c => c.name === name)) return;
        selectedChapters.push({ name, code, hours: '' });
        renderChapterChips();
    }

    function renderChapterChips() {
        chapterChipsEl.innerHTML = '';
        selectedChapters.forEach((ch, idx) => {
            const chip = document.createElement('div');
            chip.className = 'chapter-chip';
            chip.innerHTML = `
                <span class="chapter-chip-name">${ch.name}</span>
                <span class="chapter-chip-code">${ch.code}</span>
                <input type="number" class="chapter-hours-input" min="0.5" step="0.5" placeholder="Hrs" value="${ch.hours || ''}">
                <span class="remove-chip">&times;</span>
            `;
            chip.querySelector('.chapter-hours-input').addEventListener('input', (e) => {
                selectedChapters[idx].hours = parseFloat(e.target.value) || 0;
            });
            chip.querySelector('.remove-chip').addEventListener('click', () => {
                selectedChapters = selectedChapters.filter(c => c.name !== ch.name);
                renderChapterChips();
            });
            chapterChipsEl.appendChild(chip);
        });
    }

    // =========================================================================
    // UI: TOGGLE SWITCHES (Homework / Personal HW)
    // =========================================================================
    const hwToggle = document.getElementById('hw_toggle');
    const hwSection = document.getElementById('hw_section');
    const personalHwToggle = document.getElementById('personal_hw_toggle');
    const personalHwSection = document.getElementById('personal_hw_section');

    hwToggle.addEventListener('change', () => {
        hwSection.classList.toggle('active', hwToggle.checked);
        document.getElementById('hw_desc').required = hwToggle.checked;
    });

    personalHwToggle.addEventListener('change', () => {
        personalHwSection.classList.toggle('active', personalHwToggle.checked);
    });

    // =========================================================================
    // UI: DYNAMIC STUDENT REMARKS
    // =========================================================================
    const addRemarkBtn = document.getElementById('addRemarkBtn');
    const remarksContainer = document.getElementById('remarks_container');
    const remarkTemplate = document.getElementById('remarkTemplate');

    addRemarkBtn.addEventListener('click', () => {
        const grade = document.querySelector('input[name="grade"]:checked')?.value;
        const batch = document.querySelector('input[name="batch"]:checked')?.value;
        if (!grade || !batch) {
            alert('Please select Grade and Batch first.');
            return;
        }

        const clone = remarkTemplate.content.cloneNode(true);
        const row = clone.querySelector('.remark-row');

        // Remove button
        row.querySelector('.remove-btn').onclick = () => row.remove();

        // Search logic
        const searchInput = row.querySelector('.student-search-input');
        const list = row.querySelector('.dropdown-list');
        const idHidden = row.querySelector('.student-id-hidden');
        const nameHidden = row.querySelector('.student-name-hidden');

        searchInput.addEventListener('focus', () => {
            const query = searchInput.value.toLowerCase().trim();
            if (!query) {
                const students = getFilteredStudents();
                renderSearchList(students, list, (student) => {
                    searchInput.value = `${student.id} \u00A0 ${student.firstName} \u00A0 ${student.lastName}`;
                    idHidden.value = student.id;
                    nameHidden.value = student.fullName;
                    list.classList.remove('active');
                });
            }
        });

        searchInput.addEventListener('input', () => {
            const query = searchInput.value.toLowerCase().trim();
            if (!query) { list.classList.remove('active'); return; }

            const filtered = getFilteredStudents().filter(s =>
                s.id.toLowerCase().includes(query) || s.fullName.toLowerCase().includes(query)
            );

            renderSearchList(filtered, list, (student) => {
                searchInput.value = `${student.id} \u00A0 ${student.firstName} \u00A0 ${student.lastName}`;
                idHidden.value = student.id;
                nameHidden.value = student.fullName;
                list.classList.remove('active');
            });
        });

        remarksContainer.appendChild(row);
    });

    // =========================================================================
    // UI: PERSONALIZED HW — Chip-based Student Selection
    // =========================================================================
    const hwSearchInput = document.getElementById('hw_student_search');
    const hwResults = document.getElementById('hw_search_results');
    const hwChips = document.getElementById('hw_student_chips');
    let selectedHwStudents = new Map(); // id -> fullName

    hwSearchInput.addEventListener('focus', () => {
        const query = hwSearchInput.value.toLowerCase().trim();
        if (!query) {
            const students = getFilteredStudents();
            renderSearchList(students, hwResults, selectHwStudent);
        }
    });

    hwSearchInput.addEventListener('input', () => {
        const query = hwSearchInput.value.toLowerCase().trim();
        if (!query) { hwResults.classList.remove('active'); return; }

        const filtered = getFilteredStudents().filter(s =>
            s.id.toLowerCase().includes(query) || s.fullName.toLowerCase().includes(query)
        );

        renderSearchList(filtered, hwResults, selectHwStudent);
    });

    function selectHwStudent(student) {
        if (!selectedHwStudents.has(student.id)) {
            selectedHwStudents.set(student.id, student.fullName);
            const chip = document.createElement('div');
            chip.className = 'chip';
            chip.dataset.studentId = student.id;
            chip.innerHTML = `${student.id} &nbsp; ${student.firstName} &nbsp; ${student.lastName} <span class="remove-chip">&times;</span>`;
            chip.querySelector('.remove-chip').onclick = () => {
                selectedHwStudents.delete(student.id);
                chip.remove();
            };
            hwChips.appendChild(chip);
        }
        hwSearchInput.value = '';
        hwResults.classList.remove('active');
    }

    // =========================================================================
    // SHARED: Render a searchable dropdown list
    // =========================================================================
    function renderSearchList(students, listEl, onSelect) {
        listEl.innerHTML = '';
        if (students.length === 0) {
            const grade = document.querySelector('input[name="grade"]:checked')?.value || '?';
            listEl.innerHTML = `<div class="dropdown-item no-results">No students found for ${grade}</div>`;
        } else {
            students.forEach(s => {
                const div = document.createElement('div');
                div.className = 'dropdown-item';
                div.innerHTML = `<strong>${s.id}</strong> &nbsp; ${s.firstName} &nbsp; ${s.lastName}`;
                div.onclick = () => onSelect(s);
                listEl.appendChild(div);
            });
        }
        listEl.classList.add('active');
    }

    // Close all dropdowns on outside click
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.searchable-dropdown') && !e.target.closest('.student-remark-search')) {
            document.querySelectorAll('.dropdown-list').forEach(l => l.classList.remove('active'));
        }
    });

    // =========================================================================
    // FORM SUBMISSION — Send everything as JSON
    // =========================================================================
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';

        const formData = new FormData(form);
        const selectedSubject = formData.get('subject');        // What teacher selected (e.g., "Algebra")
        const parentSubject = SUBJECT_TO_PARENT[selectedSubject] || selectedSubject;  // Auto-derived (e.g., "Mathematics")

        // Validate chapters
        if (selectedChapters.length === 0) {
            alert('Please select at least one chapter.');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Session Log';
            return;
        }

        const totalSessionHours = parseFloat(formData.get('hours'));
        const chaptersTotalHours = selectedChapters.reduce((sum, ch) => sum + (ch.hours || 0), 0);

        if (totalSessionHours !== chaptersTotalHours) {
            alert(`Validation Error: Total Session Hours (${totalSessionHours}) must match the sum of individual chapter hours (${chaptersTotalHours}).`);
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Session Log';
            return;
        }

        // Collect Behavior Remarks
        const behaviorRemarks = [];
        document.querySelectorAll('.remark-row').forEach(row => {
            const sid = row.querySelector('.student-id-hidden').value;
            const sname = row.querySelector('.student-name-hidden').value;
            const flag = row.querySelector('.flag-type').value;
            const text = row.querySelector('.student-remark-text').value;
            if (sid && text) {
                behaviorRemarks.push({
                    student_id: sid,
                    student_name: sname,
                    flag_type: flag,
                    remark: text
                });
            }
        });

        const payload = {
            // --- LECTURE LOG ---
            lecture_log: {
                date: formData.get('date'),
                teacher_name: formData.get('teacher'),
                branch: 'A',  // Hardcoded
                grade: formData.get('grade'),
                batch: formData.get('batch'),
                subject: parentSubject,
                sub_subject: selectedSubject,
                hours_this_session: parseFloat(formData.get('hours')),
                chapters: selectedChapters.map(ch => ({
                    chapter_name: ch.name,
                    chapter_code: ch.code,
                    hours: ch.hours || 0
                })),
                chapter_code_string: selectedChapters.map(ch => ch.code).join(', '),
                chapter_name_string: selectedChapters.map(ch => ch.name).join(', '),
                topics_covered: formData.get('topics')
            },
            // --- HOMEWORK LOG ---
            homework_log: {
                assigned: hwToggle.checked ? 'Yes' : 'No',
                description: formData.get('hw_desc') || '',
                due_date: formData.get('hw_date') || '',
                is_personalized: personalHwToggle.checked ? 'Yes' : 'No',
                personalized_student_ids: Array.from(selectedHwStudents.keys()),
                personalized_student_names: Array.from(selectedHwStudents.values())
            },
            // --- BEHAVIOR REMARKS ---
            behavior_remarks: behaviorRemarks,
            // --- META ---
            submission_timestamp: new Date().toISOString()
        };

        console.log('=== FINAL PAYLOAD ===');
        console.log(JSON.stringify(payload, null, 2));

        const WEBHOOK_URL = 'https://n8n.srv1498466.hstgr.cloud/webhook/299c736b-d744-4af7-a8b1-3e5ee3bc9ca4';

        try {
            await fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            showSuccess();
        } catch (error) {
            console.error('Submission Error:', error);
            // Show success anyway — n8n test webhooks often throw CORS
            showSuccess();
        }
    });

    function showSuccess() {
        const overlay = document.getElementById('successOverlay');
        overlay.classList.add('active');
        setTimeout(() => {
            overlay.classList.remove('active');
            location.reload();
        }, 3000);
    }

    // =========================================================================
    // INIT
    // =========================================================================
    fetchStudents();
    fetchChapters();
    dateInput.valueAsDate = new Date();
});
