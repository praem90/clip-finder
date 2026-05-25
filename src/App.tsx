import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import Media from "./pages/media";
import Search from "./pages/search";


export function App() {
  return (
    <div className="p-4 h-screen">
      <Tabs defaultValue="search" className="wv h-full">
        <TabsList>
          <TabsTrigger value="search">Search</TabsTrigger>
          <TabsTrigger value="media">Media</TabsTrigger>
        </TabsList>
        <TabsContent value="search">
          <Search />
        </TabsContent>
        <TabsContent value="media">
          <Media />
        </TabsContent>
      </Tabs>
    </div>
  )
}


export default App;
