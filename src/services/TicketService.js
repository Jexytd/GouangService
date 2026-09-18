const crypto = require('node:crypto');
const db = require('../database');
const LogService = require('./LogService');

class TicketService {
    static generateTicketId() {
        const part = crypto.randomBytes(3).toString('hex').toUpperCase();
        return `TICK-${part}`;
    }

    static createTicket({ guildId, channelId, userId, userTag, category = 'general' }) {
        const data = db.getData();
        if (!data.tickets) data.tickets = [];

        const ticketRecord = {
            id: this.generateTicketId(),
            guildId,
            channelId,
            userId,
            userTag: userTag || `User:${userId}`,
            category,
            status: 'open',
            claimedBy: null,
            closedBy: null,
            closeReason: null,
            createdAt: new Date().toISOString(),
            closedAt: null,
            transcript: []
        };

        data.tickets.unshift(ticketRecord);
        // Keep maximum 2000 tickets
        if (data.tickets.length > 2000) {
            data.tickets = data.tickets.slice(0, 2000);
        }
        db.save();

        LogService.addAuditLog({
            actor: userTag,
            action: 'TICKET_CREATED',
            targetId: ticketRecord.id,
            metadata: { guildId, channelId, category }
        });

        return ticketRecord;
    }

    static getTicketByChannel(channelId) {
        if (!channelId) return null;
        const data = db.getData();
        if (!data.tickets) return null;
        return data.tickets.find(t => t.channelId === channelId);
    }

    static getOpenTicketForUser(guildId, userId) {
        const data = db.getData();
        if (!data.tickets) return null;
        return data.tickets.find(t => t.guildId === guildId && t.userId === userId && t.status !== 'closed');
    }

    static claimTicket(channelId, staffId, staffTag) {
        const ticket = this.getTicketByChannel(channelId);
        if (!ticket) return { success: false, message: 'Ticket not found.' };
        if (ticket.status === 'closed') return { success: false, message: 'Cannot claim a closed ticket.' };

        ticket.claimedBy = { id: staffId, tag: staffTag };
        ticket.status = 'claimed';
        db.save();

        LogService.addAuditLog({
            actor: staffTag,
            action: 'TICKET_CLAIMED',
            targetId: ticket.id,
            metadata: { channelId }
        });

        return { success: true, ticket };
    }

    static closeTicket(channelId, closedByTag, reason = 'Ticket solved') {
        const ticket = this.getTicketByChannel(channelId);
        if (!ticket) return { success: false, message: 'Ticket not found.' };

        ticket.status = 'closed';
        ticket.closedBy = closedByTag;
        ticket.closeReason = reason || 'No reason specified';
        ticket.closedAt = new Date().toISOString();
        db.save();

        LogService.addAuditLog({
            actor: closedByTag,
            action: 'TICKET_CLOSED',
            targetId: ticket.id,
            metadata: { reason }
        });

        return { success: true, ticket };
    }

    static saveTranscript(channelId, messagesArray = []) {
        const ticket = this.getTicketByChannel(channelId);
        if (!ticket) return false;

        ticket.transcript = messagesArray.slice(-200); // Store last 200 messages
        db.save();
        return true;
    }

    static generateTranscriptText(ticket, messages = []) {
        let text = `====================================================\n`;
        text += `TICKET TRANSCRIPT: ${ticket.id}\n`;
        text += `Server Guild ID: ${ticket.guildId}\n`;
        text += `Owner: ${ticket.userTag} (${ticket.userId})\n`;
        text += `Category: ${ticket.category}\n`;
        text += `Status: ${ticket.status.toUpperCase()}\n`;
        text += `Claimed By: ${ticket.claimedBy ? ticket.claimedBy.tag : 'Unclaimed'}\n`;
        text += `Opened: ${ticket.createdAt}\n`;
        text += `Closed: ${ticket.closedAt || 'Still Open'}\n`;
        text += `Close Reason: ${ticket.closeReason || 'N/A'}\n`;
        text += `====================================================\n\n`;

        for (const msg of messages) {
            text += `[${msg.timestamp}] ${msg.author}: ${msg.content}\n`;
            if (msg.attachments && msg.attachments.length > 0) {
                text += `  -> Attachments: ${msg.attachments.join(', ')}\n`;
            }
        }

        return text;
    }

    static getAllTickets({ page = 1, limit = 20, status = null, guildId = null } = {}) {
        const data = db.getData();
        let list = data.tickets || [];

        if (guildId) list = list.filter(t => t.guildId === guildId);
        if (status) list = list.filter(t => t.status === status);

        const startIndex = (page - 1) * limit;
        const paged = list.slice(startIndex, startIndex + limit);

        return {
            tickets: paged,
            total: list.length,
            page,
            limit,
            totalPages: Math.ceil(list.length / limit) || 1
        };
    }
}

module.exports = TicketService;
