// TODO: 실제 협업 전문가 정보가 정해지면 아래 샘플 데이터를 교체하세요.

export interface Expert {
  id: string;
  name: string;
  role: string;
  affiliation: string;
  experienceYears: number;
  specialties: string[];
  bio: string;
  email: string;
  phone: string;
  avatarColor: string;
  initials: string;
}

export const experts: Expert[] = [
  {
    id: "kim-minjun",
    name: "김민준",
    role: "공인회계사",
    affiliation: "OO회계법인",
    experienceYears: 15,
    specialties: ["비상장주식 가치평가", "상속·증여세 신고"],
    bio: "비상장주식 보충적 평가 및 세무조정 실무를 15년간 담당해왔습니다.",
    email: "expert1@unstock.example",
    phone: "02-0000-0001",
    avatarColor: "#2563eb",
    initials: "김민",
  },
  {
    id: "lee-seoyeon",
    name: "이서연",
    role: "세무사",
    affiliation: "OO세무회계",
    experienceYears: 10,
    specialties: ["상속세·증여세", "가업승계 컨설팅"],
    bio: "가업승계와 상속·증여세 신고를 중심으로 중소기업 자문을 진행하고 있습니다.",
    email: "expert2@unstock.example",
    phone: "02-0000-0002",
    avatarColor: "#059669",
    initials: "이서",
  },
  {
    id: "park-jihoon",
    name: "박지훈",
    role: "공인회계사",
    affiliation: "OO회계법인",
    experienceYears: 8,
    specialties: ["M&A 자문", "기업가치평가"],
    bio: "M&A 거래 및 투자 유치 과정에서의 기업·주식 가치평가를 전문으로 합니다.",
    email: "expert3@unstock.example",
    phone: "02-0000-0003",
    avatarColor: "#d97706",
    initials: "박지",
  },
];
