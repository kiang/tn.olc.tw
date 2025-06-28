// Data Integration Script for Tainan City Council and Government
class TainanDataIntegration {
    constructor() {
        // Set default date to today
        const today = new Date();
        this.currentDate = today.toISOString().split('T')[0]; // Format: YYYY-MM-DD
        this.allNews = [];
        this.expandedItems = new Set(); // Track which items are expanded
        this.updateDataUrls();
    }

    updateDataUrls() {
        const year = this.currentDate.substring(0, 4); // "2025"
        const month = this.currentDate.substring(5, 7); // "06"
        
        // Index URLs for both sources
        this.councilDataUrl = `https://kiang.github.io/www.tncc.gov.tw/data/${year}/${this.currentDate}.json`;
        this.govDataUrl = `https://kiang.github.io/www.tainan.gov.tw/data/${year}/${this.currentDate}.json`;
        
        // Detailed news URLs - include the month folder in the path
        this.councilBaseUrl = `https://kiang.github.io/www.tncc.gov.tw/data/${year}/${month}/${this.currentDate}_`;
        this.govBaseUrl = `https://kiang.github.io/www.tainan.gov.tw/data/${year}/${month}/${this.currentDate}_`;
    }

    setDate(dateString) {
        this.currentDate = dateString;
        this.updateDataUrls();
        this.allNews = []; // Clear existing data
        this.expandedItems.clear(); // Clear expanded state when changing dates
    }

    async fetchData() {
        try {
            // Fetch index data from both sources
            const [councilResponse, govResponse] = await Promise.all([
                fetch(this.councilDataUrl),
                fetch(this.govDataUrl)
            ]);

            let councilIndex = {};
            let govIndex = {};

            // Handle council data
            if (councilResponse.ok) {
                councilIndex = await councilResponse.json();
            } else {
                console.warn(`Council data not available for ${this.currentDate}`);
            }

            // Handle government data  
            if (govResponse.ok) {
                govIndex = await govResponse.json();
            } else {
                console.warn(`Government data not available for ${this.currentDate}`);
            }

            // Fetch detailed news from council
            const councilPromises = Object.keys(councilIndex).map(async (id) => {
                try {
                    const response = await fetch(`${this.councilBaseUrl}${id}.json`);
                    const data = await response.json();
                    return { ...data, source: 'council', id: id };
                } catch (error) {
                    console.warn(`Failed to fetch council news ${id}:`, error);
                    return null;
                }
            });

            // Fetch detailed news from government
            const govPromises = Object.keys(govIndex).map(async (id) => {
                try {
                    const response = await fetch(`${this.govBaseUrl}${id}.json`);
                    const data = await response.json();
                    return { ...data, source: 'government', id: id };
                } catch (error) {
                    console.warn(`Failed to fetch government news ${id}:`, error);
                    return null;
                }
            });

            // Wait for all data to be fetched
            const councilNews = (await Promise.all(councilPromises)).filter(item => item !== null);
            const govNews = (await Promise.all(govPromises)).filter(item => item !== null);

            // Combine and sort by date
            this.allNews = [...councilNews, ...govNews].sort((a, b) => 
                new Date(b.published) - new Date(a.published)
            );

            return this.allNews;
        } catch (error) {
            console.error('Error fetching data:', error);
            return [];
        }
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('zh-TW', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    truncateContent(content, maxLength = 200) {
        if (!content) return '';
        if (content.length <= maxLength) return content;
        return content.substring(0, maxLength) + '...';
    }

    getSourceBadge(source) {
        return source === 'council' ? 
            '<span class="govuk-tag govuk-tag--blue" style="border-radius: 15px; font-weight: 600; text-transform: none; padding: 0.3rem 0.8rem;">🏛️ 議會</span>' : 
            '<span class="govuk-tag govuk-tag--green" style="border-radius: 15px; font-weight: 600; text-transform: none; padding: 0.3rem 0.8rem;">🏢 市政府</span>';
    }

    renderNews(container, limit = 10) {
        if (!container) return;

        const newsToShow = this.allNews.slice(0, limit);
        
        if (newsToShow.length === 0) {
            const formattedDate = new Date(this.currentDate).toLocaleDateString('zh-TW', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            container.innerHTML = `
                <div class="govuk-warning-text">
                    <span class="govuk-warning-text__icon" aria-hidden="true">!</span>
                    <strong class="govuk-warning-text__text">
                        <span class="govuk-warning-text__assistive">注意</span>
                        ${formattedDate} 暫無可用資料
                    </strong>
                </div>
                <p class="govuk-body">請嘗試選擇其他日期，或稍後再試。</p>
            `;
            return;
        }

        const newsHtml = newsToShow.map(news => {
            const newsId = `${news.source}-${news.id}`;
            const isExpanded = this.expandedItems.has(newsId);
            const truncatedContent = this.truncateContent(news.content, 150);
            const showExpand = news.content && news.content.length > 150;
            
            return `
                <div class="news-item" data-news-id="${newsId}">
                    <div class="news-header">
                        <h4 class="govuk-heading-s" style="margin-bottom: 0.5rem;">
                            ${news.title || '無標題'}
                        </h4>
                        <div style="margin-bottom: 0.5rem;">
                            ${this.getSourceBadge(news.source)}
                            ${news.department ? `<span class="govuk-tag govuk-tag--grey">${news.department}</span>` : ''}
                        </div>
                        <p class="news-date">${this.formatDate(news.published)}</p>
                    </div>
                    <div class="news-content">
                        <div class="news-preview">
                            <p class="govuk-body">${isExpanded ? news.content : truncatedContent}</p>
                        </div>
                        ${showExpand ? `
                            <button type="button" 
                                    class="govuk-link news-expand-btn" 
                                    data-news-id="${newsId}"
                                    style="background: none; border: none; padding: 0; text-decoration: underline; cursor: pointer; color: #1d70b8;">
                                ${isExpanded ? '收合內容' : '展開全文'}
                            </button>
                        ` : ''}
                        ${news.tags ? `<p class="govuk-body-s" style="color: #505a5f; margin-top: 0.5rem;">${news.tags}</p>` : ''}
                        ${news.url ? `<p class="govuk-body-s" style="margin-top: 0.5rem;"><a href="${news.url}" class="govuk-link" target="_blank" rel="noopener">查看原文</a></p>` : ''}
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = newsHtml;
        
        // Add event listeners for expand/collapse buttons
        this.setupExpandButtons(container);
    }

    setupExpandButtons(container) {
        const expandButtons = container.querySelectorAll('.news-expand-btn');
        expandButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const newsId = button.getAttribute('data-news-id');
                this.toggleNewsExpansion(newsId);
            });
        });
    }

    toggleNewsExpansion(newsId) {
        if (this.expandedItems.has(newsId)) {
            this.expandedItems.delete(newsId);
        } else {
            this.expandedItems.add(newsId);
        }
        
        // Re-render to update the display
        this.renderToPage();
    }

    renderNewsByCategory(newsContainer, announcementContainer, serviceContainer) {
        const news = this.allNews.filter(item => 
            item.content && (item.content.includes('新聞') || item.content.includes('消息'))
        );
        
        const announcements = this.allNews.filter(item => 
            item.content && (item.content.includes('公告') || item.content.includes('通知') || item.content.includes('會議'))
        );
        
        const services = this.allNews.filter(item => 
            item.content && (item.content.includes('服務') || item.content.includes('申請') || item.content.includes('辦理'))
        );

        if (newsContainer) this.renderCategoryNews(newsContainer, news.slice(0, 5));
        if (announcementContainer) this.renderCategoryNews(announcementContainer, announcements.slice(0, 5));
        if (serviceContainer) this.renderCategoryNews(serviceContainer, services.slice(0, 5));
    }

    renderCategoryNews(container, news) {
        if (news.length === 0) {
            container.innerHTML = '<p class="govuk-body">暫無相關資訊</p>';
            return;
        }

        const newsHtml = news.map(item => `
            <div class="news-item">
                <h4 class="govuk-heading-s">${item.title || '無標題'}</h4>
                <p class="news-date">${this.formatDate(item.published)}</p>
                <p class="govuk-body">${this.truncateContent(item.content, 150)}</p>
                <div style="margin-top: 0.5rem;">
                    ${this.getSourceBadge(item.source)}
                    ${item.department ? `<span class="govuk-tag govuk-tag--grey">${item.department}</span>` : ''}
                </div>
            </div>
        `).join('');

        container.innerHTML = newsHtml;
    }

    searchNews(query) {
        if (!query) return this.allNews;
        
        const searchTerm = query.toLowerCase();
        return this.allNews.filter(news => 
            (news.title && news.title.toLowerCase().includes(searchTerm)) ||
            (news.content && news.content.toLowerCase().includes(searchTerm)) ||
            (news.department && news.department.toLowerCase().includes(searchTerm)) ||
            (news.tags && news.tags.toLowerCase().includes(searchTerm))
        );
    }

    highlightSearchTerm(text, searchTerm) {
        if (!text || !searchTerm) return text;
        
        const regex = new RegExp(`(${searchTerm})`, 'gi');
        return text.replace(regex, '<span class="search-highlight">$1</span>');
    }

    async init() {
        console.log('Initializing Tainan Data Integration...');
        await this.fetchData();
        console.log(`Loaded ${this.allNews.length} news items for ${this.currentDate}`);
        
        // Render initial content
        this.renderToPage();
        
        // Setup date picker
        this.setupDatePicker();
    }

    async changeDate(newDate) {
        // Show loading state
        this.showLoadingState();
        
        // Update date and fetch new data
        this.setDate(newDate);
        await this.fetchData();
        console.log(`Loaded ${this.allNews.length} news items for ${this.currentDate}`);
        
        // Re-render content
        this.renderToPage();
        
        // Update date display
        this.updateDateDisplay();
    }

    showLoadingState() {
        const container = document.getElementById('latest-news');
        if (container) {
            container.innerHTML = '<div class="loading-message"><p class="govuk-body">載入資料中...</p></div>';
        }
    }

    updateDateDisplay() {
        const dateDisplay = document.getElementById('current-date-display');
        if (dateDisplay) {
            const formattedDate = new Date(this.currentDate).toLocaleDateString('zh-TW', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            dateDisplay.textContent = formattedDate;
        }
    }

    setupDatePicker() {
        const datePicker = document.getElementById('date-picker');
        if (datePicker) {
            datePicker.value = this.currentDate;
            datePicker.addEventListener('change', (e) => {
                this.changeDate(e.target.value);
            });
        }
        
        // Setup dynamic quick date buttons
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const dayBefore = new Date(today);
        dayBefore.setDate(dayBefore.getDate() - 2);
        
        const quickButtons = [
            { id: 'quick-today', date: today.toISOString().split('T')[0] },
            { id: 'quick-yesterday', date: yesterday.toISOString().split('T')[0] },
            { id: 'quick-day-before', date: dayBefore.toISOString().split('T')[0] }
        ];
        
        quickButtons.forEach(({ id, date }) => {
            const button = document.getElementById(id);
            if (button) {
                button.addEventListener('click', () => {
                    // Update the date picker value
                    if (datePicker) {
                        datePicker.value = date;
                    }
                    // Change to the selected date
                    this.changeDate(date);
                });
            }
        });
        
        // Update initial date display
        this.updateDateDisplay();
    }

    renderToPage() {
        // Update main news section
        const mainNewsContainer = document.getElementById('latest-news');
        if (mainNewsContainer) {
            this.renderNews(mainNewsContainer, 20); // Show more items since we removed categories
        }

        // Setup search functionality
        this.setupSearch();
    }

    setupSearch() {
        const searchForm = document.getElementById('search-form');
        const searchInput = document.getElementById('search-input');
        const clearButton = document.getElementById('clear-search');
        const searchResults = document.getElementById('search-results');
        const searchResultsContent = document.getElementById('search-results-content');
        
        if (searchForm && searchInput) {
            searchForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const query = searchInput.value.trim();
                
                if (!query) {
                    this.clearSearch();
                    return;
                }
                
                const results = this.searchNews(query);
                this.displaySearchResults(query, results);
            });
        }
        
        if (clearButton) {
            clearButton.addEventListener('click', () => {
                this.clearSearch();
            });
        }
        
        // Clear search when input is empty
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                if (!e.target.value.trim()) {
                    this.clearSearch();
                }
            });
        }
    }

    displaySearchResults(query, results) {
        const searchResults = document.getElementById('search-results');
        const searchResultsContent = document.getElementById('search-results-content');
        
        if (!searchResults || !searchResultsContent) return;
        
        if (results.length === 0) {
            searchResultsContent.innerHTML = `
                <div class="govuk-warning-text">
                    <span class="govuk-warning-text__icon" aria-hidden="true">!</span>
                    <strong class="govuk-warning-text__text">
                        <span class="govuk-warning-text__assistive">注意</span>
                        找不到包含「${query}」的相關資訊
                    </strong>
                </div>
                <p class="govuk-body">請嘗試使用其他關鍵字進行搜尋。</p>
            `;
        } else {
            // Create a temporary container for search results
            const tempContainer = document.createElement('div');
            const searchData = { allNews: results, expandedItems: this.expandedItems };
            
            // Use the existing renderNews method but with search results
            const originalAllNews = this.allNews;
            this.allNews = results;
            this.renderNews(tempContainer, results.length);
            this.allNews = originalAllNews;
            
            searchResultsContent.innerHTML = `
                <p class="govuk-body">找到 <strong>${results.length}</strong> 筆包含「<strong>${query}</strong>」的資訊：</p>
                ${tempContainer.innerHTML}
            `;
        }
        
        searchResults.style.display = 'block';
        
        // Scroll to search results
        searchResults.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    clearSearch() {
        const searchInput = document.getElementById('search-input');
        const searchResults = document.getElementById('search-results');
        
        if (searchInput) {
            searchInput.value = '';
        }
        
        if (searchResults) {
            searchResults.style.display = 'none';
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    window.tainanData = new TainanDataIntegration();
    await window.tainanData.init();
});