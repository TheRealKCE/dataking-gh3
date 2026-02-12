import { DriveStep } from 'driver.js';

type UserRole = 'customer' | 'agent';

/**
 * Community Section Step (Reusable)
 * Used at the end of every page tutorial
 */
function getCommunityStep(): DriveStep {
  return {
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
      side: 'top',
      align: 'center'
    }
  };
}

/**
 * Dashboard Tutorial Steps
 */
export function getDashboardTutorialSteps(userRole: UserRole): DriveStep[] {
  const steps: DriveStep[] = [
    // Welcome
    {
      popover: {
        title: userRole === 'agent' ? '👋 Welcome Agent!' : '👋 Welcome to KingFlexy Data!',
        description: `
          <div>
            <p>${userRole === 'agent' ? 'Welcome to your Agent Dashboard! Let\'s explore the features available to you.' : 'Let\'s take a quick tour of your dashboard and learn how to use the platform.'}</p>
            <p style="margin-top: 8px; font-size: 14px; color: #666;">
              <em>This tour will only take 2 minutes. You can skip it anytime or replay it later from the Tutorial button.</em>
            </p>
          </div>
        `
      }
    },
    // Wallet
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
    // Statistics Cards
    {
      element: '#stats-cards',
      popover: {
        title: '📊 Your Statistics',
        description: `
          <div>
            <p>Track your order statistics at a glance:</p>
            <ul style="margin-top: 8px; margin-left: 16px; margin-bottom: 0;">
              <li><strong>Total Orders</strong> - All orders you've placed</li>
              <li><strong>Completed</strong> - Successfully delivered orders</li>
              <li><strong>Processing</strong> - Orders being processed</li>
              <li><strong>Failed</strong> - Orders that need attention</li>
            </ul>
          </div>
        `,
        side: 'bottom',
        align: 'start'
      }
    }
  ];

  // Agent-specific steps
  if (userRole === 'agent') {
    steps.push({
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
    });

    steps.push({
      element: '#bulk-orders',
      popover: {
        title: '📦 Bulk Orders',
        description: `
          <div>
            <p>Place multiple orders at once! Great for serving multiple customers efficiently.</p>
            <div style="margin-top: 12px; padding: 12px; background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
              <strong>⚠️ Important Tip:</strong>
              <p style="margin-top: 4px; margin-bottom: 0;">Avoid buying data twice for the same phone number. The system will help detect duplicates!</p>
            </div>
          </div>
        `,
        side: 'top',
        align: 'start'
      }
    });
  }

  // Community section (for all users)
  steps.push(getCommunityStep());

  // Completion
  steps.push({
    popover: {
      title: '🎉 Dashboard Tour Complete!',
      description: `
        <div>
          <p>You now know your way around the dashboard!</p>
          <p style="margin-top: 12px; padding: 10px; background: #f0f9ff; border-radius: 6px; margin-bottom: 0;">
            <strong>💡 Tip:</strong> Click the <strong>Tutorial</strong> button on any page to learn about that page's features!
          </p>
        </div>
      `
    }
  });

  return steps;
}

/**
 * Order History Page Tutorial Steps
 */
export function getOrderHistoryTutorialSteps(): DriveStep[] {
  return [
    // Welcome
    {
      popover: {
        title: '📋 Welcome to Order History',
        description: `
          <div>
            <p>This page shows all your past and current orders. Let's explore the features!</p>
          </div>
        `
      }
    },
    // Order Table
    {
      element: '#orders-table',
      popover: {
        title: '📦 Your Orders',
        description: `
          <div>
            <p>View all your orders with details like:</p>
            <ul style="margin-top: 8px; margin-left: 16px; margin-bottom: 0;">
              <li>Phone number and network</li>
              <li>Package details and price</li>
              <li>Order status and date</li>
            </ul>
          </div>
        `,
        side: 'top',
        align: 'start'
      }
    },
    // Filters
    {
      element: '#order-filters',
      popover: {
        title: '🔍 Filter Orders',
        description: `
          <div>
            <p>Use filters to find specific orders:</p>
            <ul style="margin-top: 8px; margin-left: 16px; margin-bottom: 0;">
              <li>Filter by status (Completed, Pending, Failed)</li>
              <li>Filter by network (MTN, Vodafone, AirtelTigo)</li>
              <li>Search by phone number</li>
            </ul>
          </div>
        `,
        side: 'bottom',
        align: 'start'
      }
    },
    // Complaint Button
    {
      element: '#complaint-button',
      popover: {
        title: '🆘 Submit Complaint',
        description: `
          <div>
            <p>Having an issue with an order? Submit a complaint for quick resolution.</p>
            <div style="margin-top: 12px; padding: 12px; background: #d1ecf1; border-left: 4px solid #17a2b8; border-radius: 4px;">
              <strong>💡 Pro Tip:</strong>
              <p style="margin-top: 4px; margin-bottom: 0;">Write clear, detailed complaints for faster resolutions. Include phone number, network, and detailed issue description.</p>
            </div>
          </div>
        `,
        side: 'bottom',
        align: 'start'
      }
    },
    // Community
    getCommunityStep(),
    // Completion
    {
      popover: {
        title: '🎉 Order History Tour Complete!',
        description: `
          <div>
            <p>You now know how to track and manage your orders!</p>
            <p style="margin-top: 12px; padding: 10px; background: #f0f9ff; border-radius: 6px; margin-bottom: 0;">
              <strong>💡 Tip:</strong> Click the <strong>Tutorial</strong> button anytime to replay this tour!
            </p>
          </div>
        `
      }
    }
  ];
}

/**
 * Complaints Page Tutorial Steps
 */
export function getComplaintsTutorialSteps(): DriveStep[] {
  return [
    // Welcome
    {
      popover: {
        title: '🆘 Welcome to Complaints',
        description: `
          <div>
            <p>Submit and track complaints for any issues you encounter. Let's see how it works!</p>
          </div>
        `
      }
    },

    // Complaint History
    {
      element: '#complaint-history',
      popover: {
        title: '📜 Complaint History',
        description: `
          <div>
            <p>Track all your submitted complaints and their status:</p>
            <ul style="margin-top: 8px; margin-left: 16px; margin-bottom: 0;">
              <li><strong>Pending</strong> - Under review</li>
              <li><strong>In Progress</strong> - Being resolved</li>
              <li><strong>Resolved</strong> - Issue fixed</li>
            </ul>
          </div>
        `,
        side: 'top',
        align: 'start'
      }
    },
    // Community
    getCommunityStep(),
    // Completion
    {
      popover: {
        title: '🎉 Complaints Tour Complete!',
        description: `
          <div>
            <p>You now know how to submit and track complaints!</p>
            <p style="margin-top: 12px; padding: 10px; background: #f0f9ff; border-radius: 6px; margin-bottom: 0;">
              <strong>💡 Tip:</strong> Always provide detailed information for faster resolutions!
            </p>
          </div>
        `
      }
    }
  ];
}

/**
 * Profile Page Tutorial Steps
 */
export function getProfileTutorialSteps(): DriveStep[] {
  return [
    // Welcome
    {
      popover: {
        title: '⚙️ Welcome to Profile Settings',
        description: `
          <div>
            <p>Manage your account information and preferences here. Let's explore!</p>
          </div>
        `
      }
    },
    // Personal Info
    {
      element: '#personal-info',
      popover: {
        title: '👤 Personal Information',
        description: `
          <div>
            <p>Update your personal details:</p>
            <ul style="margin-top: 8px; margin-left: 16px; margin-bottom: 0;">
              <li>Name and email</li>
              <li>Phone number</li>
              <li>Profile picture</li>
            </ul>
          </div>
        `,
        side: 'bottom',
        align: 'start'
      }
    },
    // Security
    {
      element: '#security-section',
      popover: {
        title: '🔒 Security Settings',
        description: `
          <div>
            <p>Keep your account secure:</p>
            <ul style="margin-top: 8px; margin-left: 16px; margin-bottom: 0;">
              <li>Change password</li>
              <li>Enable two-factor authentication</li>
              <li>View login history</li>
            </ul>
          </div>
        `,
        side: 'bottom',
        align: 'start'
      }
    },
    // Community
    getCommunityStep(),
    // Completion
    {
      popover: {
        title: '🎉 Profile Tour Complete!',
        description: `
          <div>
            <p>You now know how to manage your account settings!</p>
            <p style="margin-top: 12px; padding: 10px; background: #f0f9ff; border-radius: 6px; margin-bottom: 0;">
              <strong>💡 Tip:</strong> Keep your information up to date for better service!
            </p>
          </div>
        `
      }
    }
  ];
}

/**
 * Upgrade Page Tutorial Steps (Customer only)
 */
export function getUpgradeTutorialSteps(): DriveStep[] {
  return [
    // Welcome
    {
      popover: {
        title: '🚀 Welcome to Agent Upgrade',
        description: `
          <div>
            <p>Become an agent to unlock exclusive features! Let's see what's available.</p>
          </div>
        `
      }
    },
    // Benefits
    {
      element: '#agent-benefits',
      popover: {
        title: '💎 Agent Benefits',
        description: `
          <div>
            <p>Unlock powerful features:</p>
            <ul style="margin-top: 8px; margin-left: 16px; margin-bottom: 0;">
              <li>Quick wallet top-up options</li>
              <li>Bulk order capabilities</li>
              <li>Earn commissions on sales</li>
              <li>Priority support</li>
            </ul>
          </div>
        `,
        side: 'bottom',
        align: 'start'
      }
    },
    // Pricing
    {
      element: '#pricing-plans',
      popover: {
        title: '💰 Pricing Plans',
        description: `
          <div>
            <p>Choose a plan that fits your needs:</p>
            <ul style="margin-top: 8px; margin-left: 16px; margin-bottom: 0;">
              <li>Daily, weekly, or monthly plans</li>
              <li>Flexible payment options</li>
              <li>Cancel anytime</li>
            </ul>
          </div>
        `,
        side: 'top',
        align: 'start'
      }
    },
    // Community
    getCommunityStep(),
    // Completion
    {
      popover: {
        title: '🎉 Upgrade Tour Complete!',
        description: `
          <div>
            <p>You now know all about becoming an agent!</p>
            <p style="margin-top: 12px; padding: 10px; background: #f0f9ff; border-radius: 6px; margin-bottom: 0;">
              <strong>💡 Tip:</strong> Perfect for resellers and businesses!
            </p>
          </div>
        `
      }
    }
  ];
}
/**
 * Wallet Page Tutorial Steps
 */
export function getWalletTutorialSteps(userRole: UserRole): DriveStep[] {
  const steps: DriveStep[] = [
    // Welcome
    {
      popover: {
        title: '💰 Your Wallet',
        description: `
          <div>
            <p>Manage your funds securely and view your transaction history here.</p>
          </div>
        `
      }
    }
  ];

  if (userRole === 'agent') {
    steps.push({
      element: '#wallet-balance-card',
      popover: {
        title: '💳 Agent Balance',
        description: `
          <div>
            <p>Check your available balance, total credited amount, and total spent.</p>
          </div>
        `,
        side: 'bottom',
        align: 'start'
      }
    });

    steps.push({
      element: '#quick-topup-card',
      popover: {
        title: '⚡ Quick Top-Up (No Fees)',
        description: `
          <div>
            <p>Send money directly via MoMo to avoid Paystack charges!</p>
            <p style="margin-top: 8px; font-size: 12px; opacity: 0.8;">Follow the 3 easy steps shown here.</p>
          </div>
        `,
        side: 'top',
        align: 'start'
      }
    });
  }

  steps.push({
    element: '#top-up-form',
    popover: {
      title: '➕ Top Up Wallet',
      description: `
        <div>
          <p>Instantly load your wallet using Mobile Money or Card.</p>
          <p style="margin-top: 8px; font-size: 12px;">Choose a quick amount or enter a custom one.</p>
        </div>
      `,
      side: 'bottom',
      align: 'start'
    }
  });

  steps.push({
    element: '#recent-activity',
    popover: {
      title: '📜 Transaction History',
      description: `
        <div>
          <p>Track all your wallet activities, including top-ups and spending.</p>
        </div>
      `,
      side: 'top',
      align: 'start'
    }
  });

  steps.push(getCommunityStep());

  steps.push({
    popover: {
      title: '🎉 Wallet Tour Complete!',
      description: `
        <div>
          <p>You're ready to manage your funds!</p>
        </div>
      `
    }
  });

  return steps;
}

/**
 * Data Packages Page Tutorial Steps
 */
export function getDataPackagesTutorialSteps(userRole: UserRole): DriveStep[] {
  const steps: DriveStep[] = [
    // Welcome
    {
      popover: {
        title: '📦 Data Packages',
        description: `
          <div>
            <p>Browse and purchase affordable data bundles for all networks.</p>
          </div>
        `
      }
    },
    // Stats
    {
      element: '#stats-dashboard',
      popover: {
        title: '📊 Quick Stats',
        description: `
          <div>
            <p>See your current balance and today's order count at a glance.</p>
          </div>
        `,
        side: 'bottom',
        align: 'center'
      }
    }
  ];

  if (userRole === 'agent') {
    steps.push({
      element: '#bulk-order-section',
      popover: {
        title: '🚀 Bulk Orders',
        description: `
          <div>
            <p><strong>Agent Exclusive:</strong> Import multiple orders via Excel or Text!</p>
            <p style="margin-top: 8px; font-size: 12px; opacity: 0.8;">Great for processing many client orders at once.</p>
          </div>
        `,
        side: 'bottom',
        align: 'start'
      }
    });
  }

  // Filters
  steps.push({
    element: '#package-filters',
    popover: {
      title: '🔍 Find Packages',
      description: `
        <div>
          <p>Filter by <strong>Network</strong> or search for specific bundles.</p>
        </div>
      `,
      side: 'bottom',
      align: 'start'
    }
  });

  // Package List
  steps.push({
    element: '#packages-grid',
    popover: {
      title: '📱 Select & Buy',
      description: `
        <div>
          <p>Click "Buy Now" on any package to purchase instantly.</p>
        </div>
      `,
      side: 'top',
      align: 'start'
    }
  });

  steps.push(getCommunityStep());

  steps.push({
    popover: {
      title: '🎉 Tour Complete!',
      description: `
        <div>
          <p>Start saving on data bundles today!</p>
        </div>
      `
    }
  });

  return steps;
}
