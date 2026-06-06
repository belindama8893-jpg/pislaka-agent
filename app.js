const chatMessages = document.getElementById('chat-messages');
const aiInput = document.getElementById('ai-input');
const listingModal = document.getElementById('preview-modal');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toast-message');

function addMessage(text, isUser = false) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${isUser ? 'user-message' : 'ai-message'}`;
    
    msgDiv.innerHTML = `
        <div class="message-content">
            ${text}
        </div>
    `;
    
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showTypingIndicator() {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message ai-message typing-id';
    msgDiv.id = 'typing-indicator';
    msgDiv.innerHTML = `
        <div class="typing-indicator">
            <span></span>
            <span></span>
            <span></span>
        </div>
    `;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function removeTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) {
        indicator.remove();
    }
}

function handleKeyPress(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}

function sendMessage() {
    const text = aiInput.value.trim();
    if (!text) return;

    addMessage(text, true);
    aiInput.value = '';

    showTypingIndicator();

    setTimeout(() => {
        removeTypingIndicator();
        processUserCommand(text);
    }, 1500);
}

function handleSuggestion(text) {
    aiInput.value = text;
    sendMessage();
}

function processUserCommand(text) {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('marla') || lowerText.includes('kanal') || lowerText.includes('发布') || lowerText.includes('房子')) {
        addMessage(`I've extracted the details from your message. Here is the AI-optimized listing draft:
        <div class="chat-widget-card">
            <div class="chat-widget-header">
                <span><i class="fa-solid fa-wand-magic-sparkles"></i> AI Drafted Listing</span>
            </div>
            <div class="chat-listing-title">Beautiful Property in Prime Location</div>
            <div class="chat-listing-meta">Smart Pricing Applied • Ready to Post</div>
            <p style="font-size: 0.85rem; color: #64748b; margin-bottom: 12px;">AI Description: An exceptional property featuring modern amenities and prime accessibility. Ideal for families looking for a premium lifestyle.</p>
            <div class="chat-listing-actions">
                <button class="btn-primary btn-sm" onclick="publishListing()"><i class="fa-solid fa-cloud-arrow-up"></i> Publish Everywhere</button>
                <button class="btn-outline btn-sm" onclick="triggerListingFlow()">Edit Details</button>
            </div>
        </div>`);
    } else if (lowerText.includes('post') || lowerText.includes('manage my listings')) {
        addMessage(`Here is your pending draft for the DHA Phase 6 property. You can publish it directly from here:
        <div class="chat-widget-card">
            <div class="chat-widget-header">
                <span><i class="fa-solid fa-house"></i> Listing Preview</span>
            </div>
            <div class="chat-listing-title">Luxurious 1 Kanal Villa in DHA Phase 6</div>
            <div class="chat-listing-meta">PKR 8.5 Crore • 5 Beds • 6 Baths</div>
            <p style="font-size: 0.85rem; color: #64748b; margin-bottom: 12px;">AI Description: Experience premium living in this highly sought-after 1 Kanal designer villa located in the heart of DHA Phase 6...</p>
            <div class="chat-listing-actions">
                <button class="btn-primary btn-sm" onclick="publishListing()"><i class="fa-solid fa-cloud-arrow-up"></i> Publish Everywhere</button>
                <button class="btn-outline btn-sm" onclick="triggerListingFlow()">Edit</button>
            </div>
        </div>`);
    } else if (lowerText.includes('lead') || lowerText.includes('review')) {
        addMessage(`Here are your top urgent leads. I've already drafted replies for you:
        <div class="chat-widget-card" style="border-left: 4px solid var(--accent-color);">
            <div class="chat-widget-header">
                <span><i class="fa-solid fa-bolt"></i> Sarah Ahmed</span>
                <span style="font-size: 0.8rem; font-weight: normal; color: #64748b;">DHA Phase 6 (1 Kanal)</span>
            </div>
            <p style="font-size: 0.85rem; margin-bottom: 12px; background: #f8fafc; padding: 8px; border-radius: 6px;">"Hi Sarah, we have great options for DHA Phase 6. Do you prefer a corner plot?"</p>
            <button class="btn-primary btn-sm" onclick="showToast('Message sent to Sarah via WhatsApp!')"><i class="fa-brands fa-whatsapp"></i> Send Auto-Reply</button>
        </div>`);
    } else if (lowerText.includes('data') || lowerText.includes('analytic')) {
        addMessage(`Here is your performance and lead attribution for this week:
        <div class="chat-widget-card">
            <div class="chat-widget-header">
                <span><i class="fa-solid fa-chart-pie"></i> Weekly Analytics</span>
            </div>
            <div class="chat-data-row">
                <span>Total New Leads</span>
                <strong>14 <span style="color: var(--success-color); font-size: 0.8rem;">↑ 3</span></strong>
            </div>
            <div class="chat-data-row" style="flex-direction: column; align-items: stretch; border-bottom: none;">
                <span style="font-size: 0.8rem; color: #64748b; margin-top: 8px;">Lead Source Attribution</span>
                <div class="analytics-bar-container">
                    <div class="bar-fb" title="Facebook: 60%"></div>
                    <div class="bar-wa" title="WhatsApp: 30%"></div>
                    <div class="bar-other" title="Other: 10%"></div>
                </div>
                <div class="analytics-legend">
                    <div class="legend-item"><div class="dot fb"></div> Facebook (60%)</div>
                    <div class="legend-item"><div class="dot wa"></div> WhatsApp (30%)</div>
                    <div class="legend-item"><div class="dot other"></div> Direct (10%)</div>
                </div>
            </div>
            <div style="margin-top: 16px; padding: 10px; background: var(--primary-light); border-left: 3px solid var(--primary-color); font-size: 0.85rem; border-radius: 0 4px 4px 0;">
                <strong>💡 AI Insight:</strong> Your WhatsApp tracking links have the highest conversion rate (12%), while Facebook brings the most volume. Consider running WhatsApp broadcasts for new DHA listings.
            </div>
        </div>`);
    } else if (lowerText.includes('campaign') || lowerText.includes('promote')) {
        addMessage(`Generating multi-channel campaign for "1 Kanal Villa, DHA Phase 6"...`, true);
        showTypingIndicator();
        setTimeout(() => {
            removeTypingIndicator();
            addMessage(`Here is your Promotion Campaign. I have generated custom copy and unique tracking links for each channel so we can attribute leads correctly.
            <div class="campaign-card">
                <div class="channel-row">
                    <div class="channel-info"><i class="fa-brands fa-facebook" style="color: #1877f2; font-size: 1.2rem;"></i> Facebook</div>
                    <div class="channel-link">pislaka.com/p/dha-1k?utm=fb_grp</div>
                    <button class="btn-primary btn-sm" style="background: #1877f2;" onclick="showToast('Posted to Facebook Groups!')">Post</button>
                </div>
                <div class="channel-row">
                    <div class="channel-info"><i class="fa-brands fa-whatsapp" style="color: #25D366; font-size: 1.2rem;"></i> WhatsApp</div>
                    <div class="channel-link">pislaka.com/p/dha-1k?utm=wa_stat</div>
                    <button class="btn-primary btn-sm" style="background: #25D366;" onclick="showToast('Shared to WhatsApp Status!')">Share</button>
                </div>
                <div class="channel-row">
                    <div class="channel-info"><i class="fa-brands fa-twitter" style="color: #1DA1F2; font-size: 1.2rem;"></i> Twitter</div>
                    <div class="channel-link">pislaka.com/p/dha-1k?utm=tw_feed</div>
                    <button class="btn-primary btn-sm" style="background: #1DA1F2;" onclick="showToast('Tweeted successfully!')">Tweet</button>
                </div>
            </div>`);
        }, 1500);
    } else if (lowerText.includes('share') || lowerText.includes('social')) {
        addMessage(`I've generated a marketing post for your DHA Phase 6 villa:<br><br>
        <em>"🏡 Looking for your dream home? This 1 Kanal Villa in DHA Phase 6 is available now! DM me for details. #LahoreRealEstate #PislakaAgent"</em><br><br>
        Should I post this to Facebook and WhatsApp?`);
        
        // Add action buttons
        setTimeout(() => {
            const btnDiv = document.createElement('div');
            btnDiv.className = 'suggested-actions';
            btnDiv.style.marginTop = '8px';
            btnDiv.innerHTML = `
                <button class="action-chip" onclick="showToast('Posted successfully to Facebook and WhatsApp!')">Yes, post it</button>
                <button class="action-chip" onclick="handleSuggestion('Edit the message first')">Edit message</button>
            `;
            chatMessages.lastChild.appendChild(btnDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }, 100);

    } else {
        addMessage(`I understand you're asking about "${text}". As an AI real estate assistant, I can help you manage listings, reply to leads, or analyze market trends. What would you like to focus on?`);
    }
}

// Modal Logic
function triggerListingFlow() {
    listingModal.classList.remove('hidden');
}

function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
}

function publishListing() {
    closeModal('preview-modal');
    showToast('Listing saved to Pislaka Inventory!');
    
    // Add AI confirmation for inventory and ask for promotion
    setTimeout(() => {
        addMessage(`✅ Your listing "1 Kanal Villa in DHA Phase 6" has been successfully added to your inventory.<br><br>Would you like me to generate a <strong>Social Media Promotion Campaign</strong> with tracking links to generate leads for this property?`);
        
        setTimeout(() => {
            const btnDiv = document.createElement('div');
            btnDiv.className = 'suggested-actions';
            btnDiv.style.marginTop = '8px';
            btnDiv.innerHTML = `
                <button class="action-chip" onclick="handleSuggestion('Yes, create a promotion campaign')"><i class="fa-solid fa-bullhorn"></i> Create Campaign</button>
                <button class="action-chip" onclick="handleSuggestion('Not right now')">Not right now</button>
            `;
            chatMessages.lastChild.appendChild(btnDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }, 100);
    }, 1000);
}

// Image Upload Simulation
function simulateImageUpload() {
    addMessage(`📸 Uploading property photos...`, true);
    showTypingIndicator();
    
    setTimeout(() => {
        removeTypingIndicator();
        addMessage(`I've analyzed the photos you uploaded. I can see a modern kitchen, a spacious living room, and a corner plot layout. 
        <br><br>I've used these visual cues to generate a beautiful listing for you.
        <div class="chat-widget-card" style="margin-top: 12px;">
            <div class="chat-widget-header">
                <span><i class="fa-solid fa-wand-magic-sparkles"></i> Vision AI Generated Listing</span>
            </div>
            <div class="chat-listing-title">Modern Villa with Premium Kitchen</div>
            <div class="chat-listing-meta">Auto-detected details • Ready for Preview</div>
            <div class="chat-listing-actions" style="margin-top: 12px;">
                <button class="btn-primary btn-sm" onclick="triggerListingFlow()"><i class="fa-solid fa-eye"></i> Preview Full Listing</button>
            </div>
        </div>`);
    }, 2000);
}

// Lead Reply Logic
function aiReplyLead(name, area) {
    addMessage(`Drafting an AI reply for ${name} regarding ${area}...`, true);
    
    setTimeout(() => {
        showToast(`Auto-reply sent to ${name} via WhatsApp!`);
        addMessage(`I've sent the following message to ${name}:<br><br><em>"Hi ${name}, I saw you are interested in ${area}. We have some great new options that just came in. Let me know when you are free for a quick call!"</em>`);
    }, 1500);
}

// Voice Recording Simulation
let isRecording = false;
let recordingTimeout;

function toggleVoiceRecording() {
    const btnVoice = document.getElementById('btn-voice');
    
    if (isRecording) {
        clearTimeout(recordingTimeout);
        stopRecording(btnVoice);
    } else {
        isRecording = true;
        btnVoice.classList.add('recording');
        aiInput.value = "";
        aiInput.placeholder = "Listening... Speak now";
        aiInput.disabled = true;
        
        recordingTimeout = setTimeout(() => {
            stopRecording(btnVoice);
        }, 3500);
    }
}

function stopRecording(btnVoice) {
    isRecording = false;
    btnVoice.classList.remove('recording');
    aiInput.disabled = false;
    aiInput.placeholder = "Type a message or use voice...";
    
    const audioHTML = `
        <div class="chat-audio">
            <i class="fa-solid fa-circle-play"></i>
            <div class="waveform"></div>
            <span class="duration">0:03</span>
        </div>
    `;
    addMessage(audioHTML, true);
    
    showTypingIndicator();
    setTimeout(() => {
        removeTypingIndicator();
        addMessage(`<strong>🎤 Voice Transcription:</strong> <em>"Help me reply to Sarah, tell her I can show her the DHA property at 3 PM today."</em>`);
        
        setTimeout(() => {
            processUserCommand('lead');
        }, 1000);
    }, 1500);
}

// Toast Logic
function showToast(msg) {
    toastMessage.textContent = msg;
    toast.classList.remove('hidden');
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

// Close modal on click outside
window.onclick = function(event) {
    if (event.target == listingModal) {
        closeModal('preview-modal');
    }
}

// Mobile Sidebar Toggle
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    sidebar.classList.toggle('open');
}
