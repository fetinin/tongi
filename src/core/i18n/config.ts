import type { AbstractIntlMessages } from 'next-intl';

import type { Locale } from './types';

export const defaultLocale = 'en';

export const timeZone = 'Europe/Amsterdam';

export const locales = [defaultLocale, 'ru'] as const;

export const localesMap = [
  { key: 'en', title: 'English' },
  { key: 'ru', title: 'Русский' },
];

const baseMessages = {
  en: {
    onboarding: {
      guard: {
        errors: {
          network:
            'Unable to reach onboarding service. Check your connection and try again.',
          unauthorized: 'Your session has expired. Please sign in again.',
          validation:
            'We could not validate your onboarding progress. Please try again shortly.',
        },
      },
      error: {
        headers: {
          network: 'Connection issue',
          validation_failed: 'Please review your onboarding status',
          unauthorized: 'Session expired',
        },
        retry: 'Retry',
        retrying: 'Retrying...',
        tryAgain: 'Try again',
      },
      welcomePage: {
        loadingTitle: 'Checking your onboarding status',
        loadingDescription:
          'Please wait a moment while we prepare the next step.',
        errorTitle: 'We hit a snag',
        errorDescription: "We couldn't verify your onboarding progress.",
        redirectTitle: 'Redirecting you',
        redirectDescription:
          'Taking you to the next step in your onboarding journey.',
      },
      welcome: {
        title: 'Connect your TON wallet',
        description:
          'Secure your rewards and unlock the rest of the onboarding journey by linking your TON wallet.',
        button: {
          connect: 'Connect TON Wallet',
          connecting: 'Connecting...',
        },
        status: {
          connectedDetailed: 'Connected wallet: {address}',
          connected: 'Wallet connected',
          disconnected: 'No wallet connected yet',
        },
        errors: {
          connectStart: 'Unable to start wallet connection. Please try again.',
          persist: 'Failed to link wallet. Please try again.',
          generic: 'Something went wrong while saving your wallet.',
        },
        list: {
          link: 'Link your wallet once. We automatically unlink it from any previous account so you stay secure.',
          requirement:
            'Wallet connection is required before searching for your buddy and earning Corgi coins.',
        },
        snackbar: {
          success: 'Wallet connected! Taking you to the next step...',
        },
      },
      buddyPage: {
        placeholders: {
          checkingTitle: 'Checking your buddy status',
          checkingDescription:
            'Please wait while we load your onboarding progress.',
          walletTitle: 'Redirecting to wallet step',
          walletDescription:
            'You need to connect your TON wallet before adding a buddy.',
          completeTitle: 'Onboarding complete',
          completeDescription: 'Taking you to the main app.',
        },
        layout: {
          title: 'Add your buddy',
          descriptionDefault:
            'Find and invite the buddy you trust to confirm corgi sightings and unlock the full experience.',
          descriptionPending:
            "We let {name} know that you want to team up. Sit tight—once they accept, you're ready to go!",
        },
        error: {
          title: 'Something went wrong',
          description: "We couldn't load your buddy status right now.",
        },
      },
      buddySearch: {
        sectionHeader: 'How buddy search works',
        tips: {
          search:
            "Search by Telegram username — we'll show if they have a TON wallet",
          request:
            "Send one request at a time; cancel any time before it's accepted",
          confirm: 'Once your buddy accepts, onboarding completes instantly',
        },
        emptyPlaceholder:
          "Start typing at least two characters of your buddy's username to search.",
        noResultsPlaceholder:
          'No matches yet — double-check the spelling or ask your buddy to share their username.',
        snackbarSuccess:
          'Buddy request sent! Waiting for your buddy to accept.',
      },
      pending: {
        header: 'Request pending',
        waitingSubtitle: 'Waiting for {name} to respond',
        submittedSubtitle: 'Sent on {date}',
        reminder: "We'll notify you instantly when they accept or reject.",
        tip: 'Tip: If you made a mistake or want to choose another buddy, you can cancel this request and send a new one immediately.',
        button: {
          cancel: 'Cancel request',
          cancelling: 'Cancelling...',
        },
        snackbar:
          'Buddy request cancelled. You can send a new request right away.',
        error: 'Failed to cancel buddy request. Please try again.',
      },
    },
    buddy: {
      search: {
        authRequiredTitle: 'Authentication Required',
        authRequiredDescription: 'Please log in to search for buddies',
        heading: 'Find Your Buddy',
        usernameLabel: 'Telegram Username',
        usernamePlaceholder: 'Enter username (without @)',
        searching: 'Searching users...',
        noResultsHeader: 'No Users Found',
        noResultsDescription:
          'No users found matching "{query}". Try a different username.',
        emptyHeader: 'Search for Buddies',
        emptyDescription:
          'Enter at least 2 characters to search for users by their Telegram username.',
        resultsHeader: 'Found {count, plural, one {# user} other {# users}}',
        sendRequest: 'Send Request',
        tonConnected: 'TON Connected',
        noTonWallet: 'No TON Wallet',
        errors: {
          authenticationRequired: 'Authentication required',
          searchFailed: 'Search failed',
        },
      },
      request: {
        modalHeader: 'Send Buddy Request',
        successHeader: 'Request Sent!',
        successDescription:
          'Your buddy request has been sent to {username}. They will receive a notification and can accept or decline your request.',
        close: 'Close',
        sendToHeader: 'Send Request To',
        tonReady: 'TON Ready',
        noWallet: 'No Wallet',
        aboutHeader: 'About Buddy Relationships',
        aboutIntro: "When you become buddies, you'll be able to:",
        aboutItems: {
          confirmSightings: "Confirm each other's corgi sightings",
          earnTogether: 'Earn Corgi coins together',
          manageWishes: 'Create and approve wishes for the marketplace',
          supportTransactions: "Support each other's TON transactions",
        },
        walletWarning:
          "⚠️ This user hasn't connected a TON wallet yet. They need to connect one to participate in Corgi coin transactions.",
        actions: {
          send: 'Send Buddy Request',
          sending: 'Sending Request...',
          cancel: 'Cancel',
        },
        authenticationHint: 'Please log in to send buddy requests',
        errors: {
          authentication: 'Authentication required to send buddy request',
          generic: 'Failed to send buddy request',
        },
        joinedDate: 'Joined {date}',
      },
    },
    mainLayout: {
      screenTooSmall: {
        title: 'Screen too small',
        description:
          'Tongi works best on screens that are at least 320 pixels wide. Enlarge your window or rotate your device to continue.',
        action: 'Continue anyway',
      },
    },
  },
  ru: {
    onboarding: {
      guard: {
        errors: {
          network:
            'Не удалось связаться со службой онбординга. Проверьте подключение и попробуйте ещё раз.',
          unauthorized: 'Сессия истекла. Пожалуйста, войдите снова.',
          validation:
            'Не удалось проверить прогресс онбординга. Попробуйте ещё раз чуть позже.',
        },
      },
      error: {
        headers: {
          network: 'Проблема с подключением',
          validation_failed: 'Перепроверьте статус онбординга',
          unauthorized: 'Сессия истекла',
        },
        retry: 'Повторить',
        retrying: 'Повторяем...',
        tryAgain: 'Попробовать снова',
      },
      welcomePage: {
        loadingTitle: 'Проверяем статус онбординга',
        loadingDescription: 'Подождите немного, мы готовим следующий шаг.',
        errorTitle: 'Что-то пошло не так',
        errorDescription: 'Не удалось подтвердить ваш прогресс онбординга.',
        redirectTitle: 'Перенаправляем',
        redirectDescription: 'Отправляем вас на следующий шаг онбординга.',
      },
      welcome: {
        title: 'Подключите TON-кошелёк',
        description:
          'Защитите свои награды и откройте следующие шаги онбординга, привязав TON-кошелёк.',
        button: {
          connect: 'Подключить TON-кошелёк',
          connecting: 'Подключаем...',
        },
        status: {
          connectedDetailed: 'Подключённый кошелёк: {address}',
          connected: 'Кошелёк подключён',
          disconnected: 'Кошелёк ещё не подключён',
        },
        errors: {
          connectStart:
            'Не удалось начать подключение кошелька. Попробуйте ещё раз.',
          persist: 'Не удалось привязать кошелёк. Попробуйте ещё раз.',
          generic: 'Что-то пошло не так при сохранении кошелька.',
        },
        list: {
          link: 'Привяжите кошелёк один раз. Мы автоматически отвяжем его от предыдущего аккаунта для вашей безопасности.',
          requirement:
            'Подключение кошелька требуется перед поиском напарника и заработком Corgi-коинов.',
        },
        snackbar: {
          success: 'Кошелёк подключён! Переходим к следующему шагу...',
        },
      },
      buddyPage: {
        placeholders: {
          checkingTitle: 'Проверяем статус напарника',
          checkingDescription:
            'Подождите, мы загружаем ваш прогресс онбординга.',
          walletTitle: 'Переход к шагу с кошельком',
          walletDescription:
            'Перед поиском напарника нужно подключить TON-кошелёк.',
          completeTitle: 'Онбординг завершён',
          completeDescription: 'Сейчас откроем основное приложение.',
        },
        layout: {
          title: 'Добавьте напарника',
          descriptionDefault:
            'Найдите напарника, которому доверяете, чтобы подтверждать встречи с корги и открыть полный функционал.',
          descriptionPending:
            '{name} уже получил ваш запрос. Как только он подтвердит, можно продолжать!',
        },
        error: {
          title: 'Что-то пошло не так',
          description: 'Не получилось загрузить статус напарника.',
        },
      },
      buddySearch: {
        sectionHeader: 'Как работает поиск напарника',
        tips: {
          search:
            'Ищите по имени пользователя Telegram — мы покажем, есть ли у него TON-кошелёк',
          request:
            'Отправляйте только один запрос за раз; отменить можно в любой момент до принятия',
          confirm:
            'Как только напарник подтвердит, онбординг завершится мгновенно',
        },
        emptyPlaceholder:
          'Начните вводить хотя бы две буквы имени пользователя вашего напарника.',
        noResultsPlaceholder:
          'Пока нет совпадений — проверьте написание или попросите напарника поделиться именем пользователя.',
        snackbarSuccess: 'Запрос отправлен! Ждём подтверждения от напарника.',
      },
      pending: {
        header: 'Запрос на рассмотрении',
        waitingSubtitle: 'Ожидаем ответ от {name}',
        submittedSubtitle: 'Отправлено {date}',
        reminder:
          'Мы сразу уведомим вас, как только напарник примет или отклонит запрос.',
        tip: 'Подсказка: если решили выбрать другого напарника, отмените этот запрос и отправьте новый.',
        button: {
          cancel: 'Отменить запрос',
          cancelling: 'Отменяем...',
        },
        snackbar: 'Запрос отменён. Можно сразу отправить новый.',
        error: 'Не удалось отменить запрос. Попробуйте ещё раз.',
      },
    },
    buddy: {
      search: {
        authRequiredTitle: 'Нужно войти',
        authRequiredDescription: 'Войдите, чтобы искать напарников',
        heading: 'Найдите напарника',
        usernameLabel: 'Имя пользователя в Telegram',
        usernamePlaceholder: 'Введите имя без @',
        searching: 'Ищем пользователей...',
        noResultsHeader: 'Пользователи не найдены',
        noResultsDescription:
          'Пользователи с именем "{query}" не найдены. Попробуйте другое имя.',
        emptyHeader: 'Поиск напарников',
        emptyDescription:
          'Введите минимум 2 символа, чтобы искать пользователей по имени в Telegram.',
        resultsHeader:
          'Найдено {count, plural, one {# пользователь} few {# пользователя} many {# пользователей} other {# пользователя}}',
        sendRequest: 'Отправить запрос',
        tonConnected: 'TON подключён',
        noTonWallet: 'Нет TON-кошелька',
        errors: {
          authenticationRequired: 'Требуется авторизация',
          searchFailed: 'Не удалось выполнить поиск',
        },
      },
      request: {
        modalHeader: 'Отправить запрос напарнику',
        successHeader: 'Запрос отправлен!',
        successDescription:
          'Запрос отправлен {username}. Он получит уведомление и сможет принять или отклонить его.',
        close: 'Закрыть',
        sendToHeader: 'Отправить запрос',
        tonReady: 'TON готов',
        noWallet: 'Нет кошелька',
        aboutHeader: 'О напарниках',
        aboutIntro: 'С напарником вы сможете:',
        aboutItems: {
          confirmSightings: 'Подтверждать встречи с корги',
          earnTogether: 'Зарабатывать Corgi-коины вместе',
          manageWishes: 'Создавать и одобрять желания в маркетплейсе',
          supportTransactions: 'Поддерживать друг друга в TON-транзакциях',
        },
        walletWarning:
          '⚠️ У этого пользователя ещё нет TON-кошелька. Ему нужно подключить его, чтобы участвовать в операциях с Corgi-коинами.',
        actions: {
          send: 'Отправить запрос',
          sending: 'Отправляем запрос...',
          cancel: 'Отмена',
        },
        authenticationHint: 'Войдите, чтобы отправлять запросы',
        errors: {
          authentication: 'Для отправки запроса нужно войти',
          generic: 'Не удалось отправить запрос',
        },
        joinedDate: 'Регистрация {date}',
      },
    },
    mainLayout: {
      screenTooSmall: {
        title: 'Слишком узкий экран',
        description:
          'Tongi лучше всего работает на экранах шире 320 пикселей. Увеличьте окно или поверните устройство, чтобы продолжить.',
        action: 'Продолжить всё равно',
      },
    },
  },
} satisfies Record<Locale, AbstractIntlMessages>;

function matchSupportedLocale(input?: string | null): Locale {
  if (!input) {
    return defaultLocale;
  }

  const normalized = input.toLowerCase();
  const supported = (locales as readonly string[]).find(
    (locale) => normalized === locale || normalized.startsWith(`${locale}-`)
  );

  return (supported as Locale | undefined) ?? defaultLocale;
}

export function resolveLocale(input?: string | null): Locale {
  return matchSupportedLocale(input);
}

export function getMessages(input?: string | null): AbstractIntlMessages {
  const locale = matchSupportedLocale(input);
  return baseMessages[locale];
}

export { baseMessages as messages };
