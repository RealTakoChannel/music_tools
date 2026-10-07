export const initialVocalGroup = {
  entries: [],
  busy: false,
  manual: false,
  autoFilled: false,
  error: null,
};

// File handles belong to the processing queue; render state contains metadata only.
export function vocalGroupReducer(state, action) {
  switch (action.type) {
    case 'add':
      return { ...state, entries: [...state.entries, ...action.entries], busy: true, error: null };
    case 'resolve':
      return {
        ...state,
        entries: state.entries.map((entry) =>
          entry.id === action.id ? { ...entry, ...action.result } : entry,
        ),
      };
    case 'finish':
      return { ...state, busy: false };
    case 'manual':
      return { ...state, manual: true };
    case 'refill':
      return { ...state, manual: false, autoFilled: true };
    case 'remove':
      return { ...state, entries: state.entries.filter((entry) => entry.id !== action.id) };
    case 'clear':
      return { ...initialVocalGroup, entries: [] };
    case 'error':
      return { ...state, error: action.error };
    default:
      return state;
  }
}
