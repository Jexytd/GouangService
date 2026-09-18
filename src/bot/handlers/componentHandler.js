const {
    handleTicketCreate,
    handleTicketClaim,
    handleTicketClosePrompt,
    handleTicketCloseModal
} = require('../components/ticketComponents');

const { handleVerifyClick } = require('../components/verifyComponents');

async function handleComponentInteraction(interaction) {
    // 1. Button Interactions
    if (interaction.isButton()) {
        const id = interaction.customId;

        if (id.startsWith('ticket:create')) {
            const category = id.split(':')[2] || 'general';
            return handleTicketCreate(interaction, category);
        }

        if (id.startsWith('ticket:claim')) {
            return handleTicketClaim(interaction);
        }

        if (id.startsWith('ticket:close')) {
            return handleTicketClosePrompt(interaction);
        }

        if (id === 'verify:click') {
            return handleVerifyClick(interaction);
        }
    }

    // 2. Select Menu Interactions
    if (interaction.isAnySelectMenu()) {
        const id = interaction.customId;

        if (id === 'ticket:category_select') {
            const selectedCategory = interaction.values[0] || 'general';
            return handleTicketCreate(interaction, selectedCategory);
        }
    }

    // 3. Modal Submissions
    if (interaction.isModalSubmit()) {
        const id = interaction.customId;

        if (id.startsWith('ticket:close_modal')) {
            return handleTicketCloseModal(interaction);
        }
    }

    // 4. Autocomplete Handling
    if (interaction.isAutocomplete()) {
        const command = interaction.client.commands.get(interaction.commandName);
        if (command && typeof command.autocomplete === 'function') {
            try {
                await command.autocomplete(interaction);
            } catch (err) {
                console.error(`[Autocomplete Error] ${interaction.commandName}:`, err);
            }
        }
    }
}

module.exports = { handleComponentInteraction };
