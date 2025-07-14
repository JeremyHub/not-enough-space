import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { useContext } from "react";
import { Context } from "./Context";

export function Leaderboard() {
	const context = useContext(Context);
	if (!context) {
		throw new Error("DBContext is not available");
	}
	const { leaderboardEntries, self, dynamicMetadata } = context;

	return (
		<Card className="border-4 border-zinc-800 bg-zinc-900 shadow-lg w-full h-full flex flex-col p-0 bg-zinc-950 overflow-hidden">
			<CardContent className="p-0 flex-1 flex flex-col overflow-auto max-w-full">
				<Table className="w-full">
					<TableHeader>
						<TableRow>
							<TableHead className="text-white">
								Rank {`(of ${dynamicMetadata.totalUsers})`}
							</TableHead>
							<TableHead className="text-white">Username</TableHead>
							<TableHead className="text-white">Size</TableHead>
							<TableHead className="text-white">Kills</TableHead>
							<TableHead className="text-white">Damage</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{Array.from(leaderboardEntries.values())
							.sort((a, b) => a.rank - b.rank)
							.filter(
								(entry) =>
									entry.rank <= 10 ||
									entry.identity.data === self.identity.data,
							)
							.map((entry) => (
								<TableRow
									key={String(entry.identity.data)}
									className={
										entry.identity.data === self.identity.data
											? "bg-zinc-700/80 font-bold "
											: "" + "max-w-full"
									}
								>
									<TableCell className="text-zinc-300">{entry.rank}</TableCell>
									<TableCell className="font-medium text-zinc-300 truncate max-w-[150px]">
										{entry.username}
									</TableCell>
									<TableCell className="text-zinc-300">
										{Math.round(entry.size)}
									</TableCell>
									<TableCell className="text-zinc-300">{entry.kills}</TableCell>
									<TableCell className="text-zinc-300">
										{Math.round(entry.damage)}
									</TableCell>
								</TableRow>
							))}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	);
}
