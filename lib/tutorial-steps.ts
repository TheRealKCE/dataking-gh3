import { DriveStep } from 'driver.js';

/**
 * Customer Tutorial Steps
 * Tutorial flow for customer role users
 */
export function getCustomerTutorialSteps(): DriveStep[] {
    return [
        // Welcome Step
        {
            popover: {
                title: '👋 Welcome to KingFlexy Data!',
                description: `
          <div>
            <p>Let's take a quick tour to help you get started with buying data and managing your orders.</p>
            <p style="margin-top: 8px; font-size: 14px; color: #666;">
              <em>This tour will only take 2 minutes. You can skip it anytime or replay it later from the Help button.</em>
            </p>
          </div>
        `,
                side: 'center',
                align: 'center'
            }
        },
        // Wallet Card
        {
            element: '#wallet-card',
            popover: {
                title: '💰 Your Wallet',
                description: `
          <div>
            <p>This shows your current balance. You'll use this balance to purchase data packages.</p>
            <p style="margin-top: 8px;">Click the "Top Up" button whenever you need to add money to your wallet.</p>
          </div>
        `,
                side: 'bottom',
                align: 'start'
            }
        },
        // Data Packages Section
        {
            element: '#data-packages',
            popover: {
                title: '📦 Browse Data Packages',
                description: `
          <div>
            <p>Here you can browse all available data packages for different networks (MTN, Vodafone, AirtelTigo).</p>
            <p style="margin-top: 8px;">Select a package that fits your needs and budget.</p>
          </div>
        `,
                side: 'top',
                align: 'start'
            }
        },
        // Buy Data - Important Warning
        {
            element: '#buy-data-section',
            popover: {
                title: '🛒 How to Buy Data',
                description: `
          <div>
            <p>Enter the phone number and select a package to purchase data.</p>
            <div style="margin-top: 12px; padding: 12px; background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
              <strong>⚠️ Important Tip:</strong>
              <p style="margin-top: 4px; margin-bottom: 0;">Avoid buying data twice for the same phone number. Always check your order history first to prevent duplicate purchases!</p>
            </div>
          </div>
        `,
                side: 'top',
                align: 'start'
            }
        },
        // Order History
        {
            element: '#order-history',
            popover: {
                title: '📋 Order History',
                description: `
          <div>
            <p>Track all your past orders here. You can see:</p>
            <ul style="margin-top: 8px; margin-left: 16px; margin-bottom: 0;">
              <li>Order status (Pending, Completed, Failed)</li>
              <li>Phone numbers and networks</li>
              <li>Package details and prices</li>
              <li>Transaction dates</li>
            </ul>
          </div>
        `,
                side: 'top',
                align: 'start'
            }
        },
        // Complaint System - Detailed Guidance
        {
            element: '#complaint-button',
            popover: {
                title: '🆘 Need Help? Submit a Complaint',
                description: `
          <div>
            <p>Having an issue with an order? Submit a complaint for quick resolution.</p>
            <div style="margin-top: 12px; padding: 12px; background: #d1ecf1; border-left: 4px solid #17a2b8; border-radius: 4px;">
              <strong>💡 Pro Tip:</strong>
              <p style="margin-top: 4px;">Write clear, detailed complaints for faster resolutions. Include:</p>
              <ul style="margin-top: 4px; margin-left: 16px; margin-bottom: 4px;">
                <li>Phone number</li>
                <li>Network provider</li>
                <li>Detailed issue description</li>
                <li>When the issue occurred</li>
              </ul>
              <p style="margin-top: 4px; margin-bottom: 0;"><em>Good complaints = faster support! ⚡</em></p>
            </div>
          </div>
        `,
                side: 'left',
                align: 'start'
            }
        },
        // Upgrade to Agent
        {
            element: '#upgrade-section',
            popover: {
                title: '🚀 Upgrade to Agent',
                description: `
          <div>
            <p>Become an agent to unlock exclusive features:</p>
            <ul style="margin-top: 8px; margin-left: 16px;">
              <li>Quick wallet top-up options</li>
              <li>Bulk order capabilities</li>
              <li>Earn commissions on sales</li>
              <li>Priority support</li>
            </ul>
            <p style="margin-top: 8px; font-weight: 600; color: #4f46e5;">
              Perfect for resellers and businesses!
            </p>
          </div>
        `,
                side: 'top',
                align: 'start'
            }
        },
        // Community Join - WhatsApp
        {
            element: '#community-section',
            popover: {
                title: '📢 Join Our Community',
                description: `
          <div>
            <p>Stay connected with us for instant updates, exclusive promotions, and priority support!</p>
            <div style="margin-top: 16px; display: flex; gap: 12px; flex-direction: column;">
              <a 
                href="https://chat.whatsapp.com/FC6jYV3VDEQ4MmdTXiFqDV" 
                target="_blank"
                style="display: flex; align-items: center; gap: 8px; padding: 12px; background: linear-gradient(135deg, #25D366 0%, #128C7E 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; box-shadow: 0 2px 8px rgba(37, 211, 102, 0.3); transition: transform 0.2s;"
                onmouseover="this.style.transform='scale(1.05)'"
                onmouseout="this.style.transform='scale(1)'"
              >
                <span>💬 Join WhatsApp Group</span>
              </a>
              <a 
                href="https://whatsapp.com/channel/0029Vb7HTfx47XeIZz7ht232" 
                target="_blank"
                style="display: flex; align-items: center; gap: 8px; padding: 12px; background: linear-gradient(135deg, #128C7E 0%, #075E54 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; box-shadow: 0 2px 8px rgba(18, 140, 126, 0.3); transition: transform 0.2s;"
                onmouseover="this.style.transform='scale(1.05)'"
                onmouseout="this.style.transform='scale(1)'"
              >
                <span>📺 Join WhatsApp Channel</span>
              </a>
            </div>
            <p style="margin-top: 12px; font-size: 12px; color: #666; text-align: center; margin-bottom: 0;">
              <em>Get instant notifications about promotions, new features, and support!</em>
            </p>
          </div>
        `,
                side: ' center',
                align: 'center'
            }
        },
        // Profile Section
        {
            element: '#profile-section',
            popover: {
                title: '⚙️ Profile & Settings',
                description: `
          <div>
            <p>Manage your account settings here:</p>
            <ul style="margin-top: 8px; margin-left: 16px; margin-bottom: 0;">
              <li>Update personal information</li>
              <li>Change password</li>
              <li>View account details</li>
              <li>Manage preferences</li>
            </ul>
          </div>
        `,
                side: 'bottom',
                align: 'start'
            }
        },
        // Completion
        {
            popover: {
                title: '🎉 Tutorial Complete!',
                description: `
          <div>
            <p>You're all set! You now know how to:</p>
            <ul style="margin-top: 8px; margin-left: 16px;">
              <li>✅ Buy data packages</li>
              <li>✅ Track your orders</li>
              <li>✅ Submit complaints</li>
              <li>✅ Join our community</li>
            </ul>
            <p style="margin-top: 12px; padding: 10px; background: #f0f9ff; border-radius: 6px; margin-bottom: 0;">
              <strong>💡 Tip:</strong> Click the <strong>Help</strong> button anytime to replay this tutorial!
            </p>
          </div>
        `,
                side: 'center',
                align: 'center'
            }
        }
    ];
}

/**
 * Agent Tutorial Steps
 * Tutorial flow for agent role users with additional features
 */
export function getAgentTutorialSteps(): DriveStep[] {
    return [
        // Welcome Step
        {
            popover: {
                title: '👋 Welcome Agent!',
                description: `
          <div>
            <p>Welcome to your Agent Dashboard! Let's explore the powerful features available to you.</p>
            <p style="margin-top: 8px; font-size: 14px; color: #666;">
              <em>This tour will show you agent-exclusive features. You can skip or replay anytime from the Help button.</em>
            </p>
          </div>
        `,
                side: 'center',
                align: 'center'
            }
        },
        // Wallet Card
        {
            element: '#wallet-card',
            popover: {
                title: '💰 Agent Wallet',
                description: `
          <div>
            <p>Your wallet shows your balance and earnings. As an agent, you have access to:</p>
            <ul style="margin-top: 8px; margin-left: 16px; margin-bottom: 0;">
              <li>Quick top-up options</li>
              <li>Commission tracking</li>
              <li>Transaction history</li>
            </ul>
          </div>
        `,
                side: 'bottom',
                align: 'start'
            }
        },
        // Quick Top-Up
        {
            element: '#quick-topup',
            popover: {
                title: '⚡ Quick Top-Up',
                description: `
          <div>
            <p>Save time with preset top-up amounts! Perfect for frequent reloads.</p>
            <p style="margin-top: 8px;">Simply click a preset amount to instantly add funds to your wallet.</p>
          </div>
        `,
                side: 'bottom',
                align: 'start'
            }
        },
        // Bulk Orders - Important Warning
        {
            element: '#bulk-orders',
            popover: {
                title: '📦 Bulk Orders',
                description: `
          <div>
            <p>Place multiple orders at once! Great for serving multiple customers efficiently.</p>
            <div style="margin-top: 12px; padding: 12px; background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
              <strong>⚠️ Important Tip:</strong>
              <p style="margin-top: 4px; margin-bottom: 0;">Even in bulk orders, avoid buying data twice for the same phone number. The system will help detect duplicates, but always double-check your list!</p>
            </div>
          </div>
        `,
                side: 'top',
                align: 'start'
            }
        },
        // Commission Info
        {
            element: '#commission-info',
            popover: {
                title: '💎 Commission & Earnings',
                description: `
          <div>
            <p>Track your earnings and commission rates here.</p>
            <p style="margin-top: 8px;">The more orders you process, the more you earn! View detailed earnings reports and withdrawal options.</p>
          </div>
        `,
                side: 'top',
                align: 'start'
            }
        },
        // Order Management
        {
            element: '#order-history',
            popover: {
                title: '📊 Order Management',
                description: `
          <div>
            <p>Manage all your customer orders in one place:</p>
            <ul style="margin-top: 8px; margin-left: 16px; margin-bottom: 0;">
              <li>Filter by status, date, or network</li>
              <li>Export order reports</li>
              <li>Track pending orders</li>
              <li>Manage complaints</li>
            </ul>
          </div>
        `,
                side: 'top',
                align: 'start'
            }
        },
        // Community Join - Agent Version
        {
            element: '#community-section',
            popover: {
                title: '📢 Join Agent Community',
                description: `
          <div>
            <p>Connect with fellow agents for tips, bulk deals, and priority support!</p>
            <div style="margin-top: 16px; display: flex; gap: 12px; flex-direction: column;">
              <a 
                href="https://chat.whatsapp.com/FC6jYV3VDEQ4MmdTXiFqDV" 
                target="_blank"
                style="display: flex; align-items: center; gap: 8px; padding: 12px; background: linear-gradient(135deg, #25D366 0%, #128C7E 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; box-shadow: 0 2px 8px rgba(37, 211, 102, 0.3); transition: transform 0.2s;"
                onmouseover="this.style.transform='scale(1.05)'"
                onmouseout="this.style.transform='scale(1)'"
              >
                <span>💬 Join Agent WhatsApp Group</span>
              </a>
              <a 
                href="https://whatsapp.com/channel/0029Vb7HTfx47XeIZz7ht232" 
                target="_blank"
                style="display: flex; align-items: center; gap: 8px; padding: 12px; background: linear-gradient(135deg, #128C7E 0%, #075E54 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; box-shadow: 0 2px 8px rgba(18, 140, 126, 0.3); transition: transform 0.2s;"
                onmouseover="this.style.transform='scale(1.05)'"
                onmouseout="this.style.transform='scale(1)'"
              >
                <span>📺 Join Agent WhatsApp Channel</span>
              </a>
            </div>
            <p style="margin-top: 12px; font-size: 12px; color: #666; text-align: center; margin-bottom: 0;">
              <em>Get agent tips, bulk deals, and priority support!</em>
            </p>
          </div>
        `,
                side: 'center',
                align: 'center'
            }
        },
        // Completion
        {
            popover: {
                title: '🎉 Agent Tutorial Complete!',
                description: `
          <div>
            <p>You're now ready to maximize your agent potential!</p>
            <ul style="margin-top: 8px; margin-left: 16px;">
              <li>✅ Quick wallet top-up</li>
              <li>✅ Efficient bulk ordering</li>
              <li>✅ Commission tracking</li>
              <li>✅ Community connection</li>
            </ul>
            <p style="margin-top: 12px; padding: 10px; background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-radius: 6px; margin-bottom: 0;">
              <strong>💡 Tip:</strong> Click the <strong>Help</strong> button anytime to replay this tutorial!
            </p>
          </div>
        `,
                side: 'center',
                align: 'center'
            }
        }
    ];
}
